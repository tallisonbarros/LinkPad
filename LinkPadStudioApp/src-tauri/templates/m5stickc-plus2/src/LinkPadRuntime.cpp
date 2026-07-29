#include "LinkPadRuntime.h"
#include "LinkPadStatusOverlay.h"

#include <HTTPClient.h>
#include <M5Unified.h>
#include <WiFi.h>
#include <limits.h>
#include <math.h>

namespace {
uint16_t colorFromHex(const char* value, uint16_t fallback) {
  if (value == nullptr || strlen(value) != 7 || value[0] != '#') return fallback;
  char* end = nullptr;
  const unsigned long rgb = strtoul(value + 1, &end, 16);
  if (end == nullptr || *end != '\0') return fallback;
  return M5.Display.color565((rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff);
}
}

LinkPadRuntime::LinkPadRuntime(const char* projectJson) : projectJson_(projectJson) {}

void LinkPadRuntime::begin() {
  auto m5config = M5.config();
  M5.begin(m5config);
  M5.Display.setRotation(3);
  M5.Display.setTextWrap(false);
  M5.Display.fillScreen(TFT_BLACK);
  M5.Display.setTextColor(TFT_WHITE, TFT_BLACK);

  auto error = deserializeJson(config_, projectJson_);
  if (error) {
    M5.Display.setCursor(5, 5);
    M5.Display.printf("Projeto invalido: %s", error.c_str());
    return;
  }

  initializeInternalTags();
  WiFi.mode(WIFI_STA);
  state_ = LinkPadState::NetworkConnecting;
  render();
}

void LinkPadRuntime::update() {
  inputAdapter_.update();
  LinkPadInputEvent input;
  bool inputHandled = false;
  while (inputAdapter_.next(input)) inputHandled = handleInput(input) || inputHandled;
  if (inputHandled) render();
  flushRetainedValues();

  const uint32_t now = millis();
  if (now < retryAt_) return;
  if (!ensureNetwork()) return;
  if (!agentOnline_ && !checkAgent()) return;

  ensureSessions();
  const uint32_t pollNow = millis();
  const uint32_t pollMs = config_["agent"]["pollMs"] | 1000;
  bool shouldRender = false;
  if (pollNow - lastPollAt_ >= pollMs) {
    lastPollAt_ = pollNow;
    for (JsonObjectConst profile : config_["protocols"].as<JsonArrayConst>()) {
      if (!(profile["enabled"] | true)) continue;
      const char* profileId = profile["id"] | "";
      if (sessionFor(profileId).isEmpty()) continue;
      readTags(profile);
      if (!agentOnline_) break;
    }
    shouldRender = true;
  }
  refreshState();
  if (shouldRender) render();
}

bool LinkPadRuntime::ensureNetwork() {
  if (WiFi.status() == WL_CONNECTED) return true;
  agentOnline_ = false;
  state_ = LinkPadState::NetworkConnecting;
  const char* ssid = config_["network"]["ssid"] | "";
  const char* password = config_["network"]["password"] | "";
  if (strlen(ssid) == 0) {
    retryAt_ = millis() + 3000;
    render();
    return false;
  }
  WiFi.begin(ssid, password);
  const uint32_t started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 8000) delay(100);
  if (WiFi.status() != WL_CONNECTED) {
    retryAt_ = millis() + 3000;
    render();
    return false;
  }
  retryAt_ = 0;
  return true;
}

bool LinkPadRuntime::checkAgent() {
  String response;
  if (request("GET", "/lpp/v1/status", "", response) != 200) {
    agentOnline_ = false;
    state_ = LinkPadState::AgentOffline;
    retryAt_ = millis() + 2000;
    render();
    return false;
  }
  if (request("GET", "/lpp/v1/capabilities", "", response) != 200) {
    agentOnline_ = false;
    state_ = LinkPadState::AgentOffline;
    retryAt_ = millis() + 2000;
    render();
    return false;
  }
  agentOnline_ = true;
  retryAt_ = 0;
  state_ = LinkPadState::AgentOnline;
  return true;
}

void LinkPadRuntime::ensureSessions() {
  for (JsonObjectConst profile : config_["protocols"].as<JsonArrayConst>()) {
    if (!(profile["enabled"] | true)) continue;
    const char* profileId = profile["id"] | "";
    if (strlen(profileId) == 0 || !sessionFor(profileId).isEmpty()) continue;
    const uint32_t retryAt = connectorStates_[profileId]["retryAt"] | 0UL;
    if (retryAt != 0 && static_cast<int32_t>(millis() - retryAt) < 0) continue;
    openSession(profile);
    if (!agentOnline_) return;
  }
}

bool LinkPadRuntime::openSession(JsonObjectConst profile) {
  const char* profileId = profile["id"] | "";
  if (strlen(profileId) == 0) return false;
  state_ = LinkPadState::SessionOpening;

  DynamicJsonDocument body(2048);
  body["contractVersion"] = config_["contractVersion"] | "0.1.0";
  body["deviceId"] = config_["deviceId"] | "linkpad-device";
  body["projectId"] = config_["projectId"] | "linkpad-project";
  body["target"]["driver"] = profile["driver"];
  body["target"]["endpoint"] = profile["endpoint"];
  body["target"]["options"] = profile["options"];
  if (profile.containsKey("auth")) body["target"]["auth"] = profile["auth"];

  String payload;
  serializeJson(body, payload);
  String response;
  const int code = request("POST", "/lpp/v1/sessions", payload, response);
  JsonObject connectorState = connectorStateFor(profileId);
  if (code != 201) {
    connectorState["sessionId"] = "";
    connectorState["tagsGood"] = false;
    connectorState["retryAt"] = millis() + 2000;
    markProfileTagsQuality(profileId, "offline");
    if (code <= 0) {
      agentOnline_ = false;
      retryAt_ = millis() + 2000;
    }
    return false;
  }

  DynamicJsonDocument parsed(1024);
  if (deserializeJson(parsed, response)) {
    connectorState["sessionId"] = "";
    connectorState["tagsGood"] = false;
    connectorState["retryAt"] = millis() + 2000;
    markProfileTagsQuality(profileId, "unknown");
    return false;
  }
  const String sessionId = parsed["sessionId"].as<String>();
  connectorState["sessionId"] = sessionId;
  connectorState["tagsGood"] = !sessionId.isEmpty();
  connectorState["retryAt"] = sessionId.isEmpty() ? millis() + 2000 : 0;
  if (sessionId.isEmpty()) markProfileTagsQuality(profileId, "unknown");
  return !sessionId.isEmpty();
}

bool LinkPadRuntime::readTags(JsonObjectConst profile) {
  const char* profileId = profile["id"] | "";
  const String sessionId = sessionFor(profileId);
  if (sessionId.isEmpty()) return false;

  DynamicJsonDocument body(8192);
  body["requestId"] = String("read-") + profileId + "-" + String(++requestSequence_);
  body["sessionId"] = sessionId;
  JsonArray points = body.createNestedArray("points");
  for (JsonObjectConst tag : config_["tags"].as<JsonArrayConst>()) {
    const char* assignedProfileId = tag["protocolProfileId"] | "";
    if (strcmp(assignedProfileId, profileId) != 0) continue;
    const char* direction = tag["direction"] | "read";
    if (strcmp(direction, "write") == 0) continue;
    JsonObject point = points.createNestedObject();
    point["id"] = tag["name"];
    point["type"] = tag["type"];
    point["address"] = tag["address"];
  }

  JsonObject connectorState = connectorStateFor(profileId);
  if (points.size() == 0) {
    connectorState["tagsGood"] = true;
    return true;
  }

  String payload;
  serializeJson(body, payload);
  String response;
  const int code = request("POST", "/lpp/v1/read", payload, response);
  if (code == 404 || code == 410) {
    invalidateSession(profileId);
    return false;
  }
  if (code != 200) {
    connectorState["tagsGood"] = false;
    markProfileTagsQuality(profileId, code <= 0 ? "offline" : "unknown");
    if (code <= 0) {
      agentOnline_ = false;
      retryAt_ = millis() + 2000;
    }
    return false;
  }

  DynamicJsonDocument parsed(8192);
  if (deserializeJson(parsed, response)) {
    connectorState["tagsGood"] = false;
    markProfileTagsQuality(profileId, "unknown");
    return false;
  }
  markProfileTagsQuality(profileId, "unknown");
  bool allGood = strcmp(parsed["status"] | "partial", "ok") == 0;
  for (JsonObjectConst item : parsed["values"].as<JsonArrayConst>()) {
    const char* id = item["id"] | "";
    if (strlen(id) == 0) continue;
    const bool itemGood = strcmp(item["status"] | "error", "ok") == 0;
    allGood = allGood && itemGood;
    if (item.containsKey("value")) values_[id]["value"] = item["value"];
    else if (item.containsKey("valor")) values_[id]["value"] = item["valor"];
    values_[id]["quality"] = item["quality"] | "unknown";
  }
  connectorState["tagsGood"] = allGood;
  return allGood;
}

bool LinkPadRuntime::handleInput(const LinkPadInputEvent& input) {
  JsonArrayConst screens = config_["screens"].as<JsonArrayConst>();
  if (currentScreen_ >= screens.size()) return false;
  JsonObjectConst screen = screens[currentScreen_];
  bool handled = false;
  for (JsonObjectConst binding : screen["inputBindings"].as<JsonArrayConst>()) {
    if (strcmp(binding["inputId"] | "", input.inputId) != 0) continue;
    if (strcmp(binding["event"] | "", input.event) != 0) continue;
    handled = executeAction(binding["action"].as<JsonObjectConst>()) || handled;
  }
  return handled;
}

bool LinkPadRuntime::executeAction(JsonObjectConst action) {
  const char* type = action["type"] | "";
  if (strcmp(type, "navigate") == 0) {
    JsonArrayConst screens = config_["screens"].as<JsonArrayConst>();
    if (screens.size() == 0) return false;
    const char* target = action["target"] | "next";
    if (strcmp(target, "next") == 0) {
      currentScreen_ = (currentScreen_ + 1) % screens.size();
      return true;
    }
    if (strcmp(target, "previous") == 0) {
      currentScreen_ = (currentScreen_ + screens.size() - 1) % screens.size();
      return true;
    }
    if (strcmp(target, "screen") == 0) {
      const char* screenId = action["screenId"] | "";
      for (size_t index = 0; index < screens.size(); ++index) {
        if (strcmp(screens[index]["id"] | "", screenId) != 0) continue;
        currentScreen_ = index;
        return true;
      }
    }
    return false;
  }
  if (strcmp(type, "activateWidget") == 0) {
    JsonArrayConst screens = config_["screens"].as<JsonArrayConst>();
    if (currentScreen_ >= screens.size()) return false;
    const char* widgetId = action["widgetId"] | "";
    for (JsonObjectConst widget : screens[currentScreen_]["widgets"].as<JsonArrayConst>()) {
      if (strcmp(widget["id"] | "", widgetId) == 0) return writeWidget(widget);
    }
    return false;
  }
  if (strcmp(type, "changeValue") == 0) return changeTagValue(action);
  if (strcmp(type, "powerOff") == 0) {
    flushRetainedValues(true);
    M5.Power.powerOff();
    return true;
  }
  return false;
}

bool LinkPadRuntime::writeWidget(JsonObjectConst widget) {
  if (strcmp(widget["type"] | "", "write_button") != 0) return false;
  return writeTagValue(widget["props"]["tag"] | "", widget["props"]["value"]);
}

bool LinkPadRuntime::changeTagValue(JsonObjectConst action) {
  const char* tagName = action["tag"] | "";
  const char* operation = action["operation"] | "set";
  if (strlen(tagName) == 0) {
    state_ = LinkPadState::WriteFailed;
    return false;
  }
  if (strcmp(operation, "set") == 0) {
    if (action["operand"].isNull()) {
      state_ = LinkPadState::WriteFailed;
      return false;
    }
    return writeTagValue(tagName, action["operand"]);
  }

  JsonObjectConst tag;
  for (JsonObjectConst candidate : config_["tags"].as<JsonArrayConst>()) {
    if (strcmp(candidate["name"] | "", tagName) == 0) {
      tag = candidate;
      break;
    }
  }
  if (tag.isNull() || strcmp(tag["direction"] | "read", "readWrite") != 0) {
    state_ = LinkPadState::WriteFailed;
    return false;
  }
  if (strcmp(tag["source"] | "agent", "internal") != 0) {
    const char* profileId = tag["protocolProfileId"] | "";
    if (strlen(profileId) == 0 || sessionFor(profileId).isEmpty()) {
      state_ = LinkPadState::WriteFailed;
      return false;
    }
  }
  if (strcmp(values_[tagName]["quality"] | "unknown", "good") != 0) {
    state_ = LinkPadState::WriteFailed;
    return false;
  }

  JsonVariantConst current = values_[tagName]["value"];
  DynamicJsonDocument nextValue(64);
  const char* valueType = tag["type"] | "";
  if (strcmp(operation, "toggle") == 0) {
    if (strcmp(valueType, "bool") != 0 || !current.is<bool>()) {
      state_ = LinkPadState::WriteFailed;
      return false;
    }
    nextValue["value"] = !current.as<bool>();
    return writeTagValue(tagName, nextValue["value"]);
  }

  if (strcmp(operation, "add") != 0 && strcmp(operation, "subtract") != 0) {
    state_ = LinkPadState::WriteFailed;
    return false;
  }
  JsonVariantConst operand = action["operand"];
  const bool currentNumeric = current.is<double>() || current.is<long>() || current.is<int>();
  const bool operandNumeric = operand.is<double>() || operand.is<long>() || operand.is<int>();
  if ((strcmp(valueType, "int") != 0 && strcmp(valueType, "float") != 0) || !currentNumeric || !operandNumeric) {
    state_ = LinkPadState::WriteFailed;
    return false;
  }
  const double signal = strcmp(operation, "subtract") == 0 ? -1.0 : 1.0;
  const double result = current.as<double>() + signal * operand.as<double>();
  if (!isfinite(result)) {
    state_ = LinkPadState::WriteFailed;
    return false;
  }
  if (strcmp(valueType, "int") == 0) {
    if (result < LONG_MIN || result > LONG_MAX || result != static_cast<long>(result)) {
      state_ = LinkPadState::WriteFailed;
      return false;
    }
    nextValue["value"] = static_cast<long>(result);
  } else {
    nextValue["value"] = result;
  }
  return writeTagValue(tagName, nextValue["value"]);
}

void LinkPadRuntime::initializeInternalTags() {
  preferencesReady_ = preferences_.begin("linkpad", false);
  if (preferencesReady_) {
    const String projectId = config_["projectId"].as<String>();
    const String storedProjectId = preferences_.getString("project", "");
    if (storedProjectId != projectId) {
      preferences_.clear();
      preferences_.putString("project", projectId);
    } else {
      const String retained = preferences_.getString("retained", "{}");
      if (deserializeJson(retainedValues_, retained)) retainedValues_.clear();
    }
  }

  for (JsonObjectConst tag : config_["tags"].as<JsonArrayConst>()) {
    if (strcmp(tag["source"] | "agent", "internal") != 0) continue;
    const char* name = tag["name"] | "";
    if (strlen(name) == 0) continue;
    const char* id = tag["id"] | "";
    if (strlen(id) == 0) id = name;

    JsonVariant valueSlot = values_[name]["value"];
    JsonObjectConst retainedRoot = retainedValues_.as<JsonObjectConst>();
    const bool hasRetainedValue = (tag["retentive"] | false)
      && preferencesReady_
      && retainedRoot.containsKey(id);
    JsonVariantConst retainedValue = retainedRoot[id];
    if (hasRetainedValue && internalValueAllowed(tag, retainedValue)) {
      valueSlot.set(retainedValue);
    } else if (!tag["initialValue"].isNull()) {
      valueSlot.set(tag["initialValue"]);
    } else {
      const char* type = tag["type"] | "float";
      if (strcmp(type, "bool") == 0) valueSlot.set(false);
      else if (strcmp(type, "string") == 0) valueSlot.set("");
      else valueSlot.set(0);
    }
    if (hasRetainedValue && !internalValueAllowed(tag, retainedValue)) {
      retainedValues_.remove(id);
      retentionDirty_ = true;
      retentionDueAt_ = millis() + 500;
    }
    values_[name]["quality"] = "good";
  }
}

bool LinkPadRuntime::internalValueAllowed(JsonObjectConst tag, JsonVariantConst value) const {
  const char* type = tag["type"] | "";
  if (strcmp(type, "bool") == 0) return value.is<bool>();
  if (strcmp(type, "string") == 0) return value.is<const char*>();

  if (!value.is<double>() && !value.is<long>() && !value.is<int>()) return false;
  const double numericValue = value.as<double>();
  if (strcmp(type, "int") == 0 && numericValue != static_cast<long>(numericValue)) return false;
  if (strcmp(type, "int") != 0 && strcmp(type, "float") != 0) return false;
  if (tag.containsKey("min") && numericValue < tag["min"].as<double>()) return false;
  if (tag.containsKey("max") && numericValue > tag["max"].as<double>()) return false;
  return true;
}

bool LinkPadRuntime::writeInternalTag(JsonObjectConst tag, JsonVariantConst value) {
  const char* direction = tag["direction"] | "readWrite";
  if (strcmp(direction, "read") == 0 || !internalValueAllowed(tag, value)) {
    state_ = LinkPadState::WriteFailed;
    return false;
  }
  const char* name = tag["name"] | "";
  if (strlen(name) == 0) {
    state_ = LinkPadState::WriteFailed;
    return false;
  }
  values_[name]["value"].set(value);
  values_[name]["quality"] = "good";
  if (tag["retentive"] | false) retainInternalValue(tag, value);
  return true;
}

void LinkPadRuntime::retainInternalValue(JsonObjectConst tag, JsonVariantConst value) {
  if (!preferencesReady_) return;
  const char* id = tag["id"] | "";
  if (strlen(id) == 0) id = tag["name"] | "";
  if (strlen(id) == 0) return;
  retainedValues_[id].set(value);
  retentionDirty_ = true;
  retentionDueAt_ = millis() + 500;
}

void LinkPadRuntime::flushRetainedValues(bool force) {
  if (!preferencesReady_ || !retentionDirty_) return;
  if (!force && static_cast<int32_t>(millis() - retentionDueAt_) < 0) return;
  String serialized;
  serializeJson(retainedValues_, serialized);
  if (preferences_.putString("retained", serialized) > 0) {
    retentionDirty_ = false;
    return;
  }
  retentionDueAt_ = millis() + 1000;
}

bool LinkPadRuntime::writeTagValue(const char* tagName, JsonVariantConst value) {
  for (JsonObjectConst tag : config_["tags"].as<JsonArrayConst>()) {
    if (strcmp(tag["name"] | "", tagName) != 0) continue;
    if (strcmp(tag["source"] | "agent", "internal") == 0) return writeInternalTag(tag, value);
    const char* profileId = tag["protocolProfileId"] | "";
    const String sessionId = sessionFor(profileId);
    if (sessionId.isEmpty()) {
      state_ = LinkPadState::WriteFailed;
      return false;
    }

    DynamicJsonDocument body(2048);
    body["requestId"] = String("write-") + String(millis()) + "-" + String(++requestSequence_);
    body["sessionId"] = sessionId;
    JsonObject write = body.createNestedArray("writes").createNestedObject();
    write["id"] = tag["name"];
    write["type"] = tag["type"];
    write["address"] = tag["address"];
    write["value"] = value;
    if (tag.containsKey("min")) write["min"] = tag["min"];
    if (tag.containsKey("max")) write["max"] = tag["max"];
    String payload;
    serializeJson(body, payload);
    String response;
    const int code = request("POST", "/lpp/v1/write", payload, response);
    if (code == 404 || code == 410) {
      invalidateSession(profileId);
      return false;
    }
    if (code != 200) {
      if (code <= 0) {
        agentOnline_ = false;
        retryAt_ = millis() + 2000;
      }
      state_ = LinkPadState::WriteFailed;
      return false;
    }
    DynamicJsonDocument parsed(2048);
    if (deserializeJson(parsed, response)) {
      state_ = LinkPadState::WriteFailed;
      return false;
    }
    JsonArrayConst results = parsed["results"].as<JsonArrayConst>();
    if (results.size() == 0) {
      state_ = LinkPadState::WriteFailed;
      return false;
    }
    JsonObjectConst result = results[0].as<JsonObjectConst>();
    const bool written = strcmp(result["status"] | "error", "written") == 0;
    if (written) {
      if (result.containsKey("value")) values_[tagName]["value"] = result["value"];
      else if (result.containsKey("valor")) values_[tagName]["value"] = result["valor"];
      values_[tagName]["quality"] = result["quality"] | "unknown";
    }
    state_ = written ? LinkPadState::TargetOnline : LinkPadState::WriteFailed;
    return written;
  }
  state_ = LinkPadState::WriteFailed;
  return false;
}

int LinkPadRuntime::request(const String& method, const String& path, const String& body, String& response) {
  WiFiClient client;
  HTTPClient http;
  http.setTimeout(config_["agent"]["timeoutMs"] | 1200);
  if (!http.begin(client, baseUrl() + path)) return -1;
  http.addHeader("Cache-Control", "no-cache");
  const char* token = config_["agent"]["token"] | "";
  if (strlen(token) > 0) http.addHeader("X-LINKPAD-TOKEN", token);
  int code;
  if (method == "POST") {
    http.addHeader("Content-Type", "application/json");
    code = http.POST(body);
  } else {
    code = http.GET();
  }
  if (code > 0) response = http.getString();
  http.end();
  return code;
}

String LinkPadRuntime::sessionFor(const char* profileId) const {
  if (profileId == nullptr || strlen(profileId) == 0) return "";
  return connectorStates_[profileId]["sessionId"].as<String>();
}

JsonObject LinkPadRuntime::connectorStateFor(const char* profileId) {
  JsonObject connectorState = connectorStates_[profileId].as<JsonObject>();
  if (connectorState.isNull()) {
    connectorState = connectorStates_.createNestedObject(profileId);
  }
  return connectorState;
}

void LinkPadRuntime::markProfileTagsQuality(const char* profileId, const char* quality) {
  if (profileId == nullptr || strlen(profileId) == 0) return;
  for (JsonObjectConst tag : config_["tags"].as<JsonArrayConst>()) {
    if (strcmp(tag["protocolProfileId"] | "", profileId) != 0) continue;
    const char* tagName = tag["name"] | "";
    if (strlen(tagName) == 0) continue;
    values_[tagName]["quality"] = quality;
  }
}

void LinkPadRuntime::invalidateSession(const char* profileId) {
  if (profileId == nullptr || strlen(profileId) == 0) return;
  JsonObject connectorState = connectorStateFor(profileId);
  connectorState["sessionId"] = "";
  connectorState["tagsGood"] = false;
  connectorState["retryAt"] = millis() + 1000;
  markProfileTagsQuality(profileId, "offline");
  state_ = LinkPadState::SessionOpening;
}

void LinkPadRuntime::refreshState() {
  if (WiFi.status() != WL_CONNECTED) {
    state_ = LinkPadState::NetworkConnecting;
  } else if (!agentOnline_) {
    state_ = LinkPadState::AgentOffline;
  } else if (onlineConnectorCount() == 0) {
    state_ = LinkPadState::SessionOpening;
  } else if (onlineConnectorCount() == enabledConnectorCount() && tagsHealthy()) {
    state_ = LinkPadState::TargetOnline;
  } else {
    state_ = LinkPadState::TagStale;
  }
}

size_t LinkPadRuntime::enabledConnectorCount() const {
  size_t count = 0;
  for (JsonObjectConst profile : config_["protocols"].as<JsonArrayConst>()) {
    if (profile["enabled"] | true) ++count;
  }
  return count;
}

size_t LinkPadRuntime::onlineConnectorCount() const {
  size_t count = 0;
  for (JsonObjectConst profile : config_["protocols"].as<JsonArrayConst>()) {
    if (!(profile["enabled"] | true)) continue;
    const char* profileId = profile["id"] | "";
    if (!sessionFor(profileId).isEmpty()) ++count;
  }
  return count;
}

bool LinkPadRuntime::tagsHealthy() const {
  if (enabledConnectorCount() == 0) return false;
  for (JsonObjectConst profile : config_["protocols"].as<JsonArrayConst>()) {
    if (!(profile["enabled"] | true)) continue;
    const char* profileId = profile["id"] | "";
    if (sessionFor(profileId).isEmpty()) return false;
    if (!(connectorStates_[profileId]["tagsGood"] | false)) return false;
  }
  return true;
}

void LinkPadRuntime::render() {
  M5.Display.fillScreen(TFT_BLACK);
  M5.Display.setTextSize(1);
  M5.Display.setTextColor(TFT_WHITE, TFT_BLACK);

  JsonArrayConst screens = config_["screens"].as<JsonArrayConst>();
  if (currentScreen_ < screens.size()) {
    for (JsonObjectConst widget : screens[currentScreen_]["widgets"].as<JsonArrayConst>()) renderWidget(widget);
  }
  renderStatusOverlay();
}

void LinkPadRuntime::renderStatusOverlay() {
  JsonObjectConst overlay = config_["ui"]["statusOverlay"].as<JsonObjectConst>();
  if (!(overlay["enabled"] | true)) return;

  bool showWifi = false;
  bool showAgent = false;
  JsonArrayConst indicators = overlay["indicators"].as<JsonArrayConst>();
  if (indicators.isNull()) {
    showWifi = true;
    showAgent = true;
  } else {
    for (const char* indicator : indicators) {
      if (strcmp(indicator, "wifi") == 0) showWifi = true;
      else if (strcmp(indicator, "agent") == 0) showAgent = true;
    }
  }
  LinkPadStatusOverlay::render(
    M5.Display,
    showWifi,
    WiFi.status() == WL_CONNECTED,
    showAgent,
    agentOnline_,
    overlay["placement"] | "top-right"
  );
}

void LinkPadRuntime::renderWidget(JsonObjectConst widget) {
  if (!(widget["visible"] | true)) return;
  const int x = widget["x"] | 0;
  const int y = widget["y"] | 0;
  const int width = widget["width"] | 80;
  const int height = widget["height"] | 20;
  const char* type = widget["type"] | "";
  JsonObjectConst props = widget["props"].as<JsonObjectConst>();
  const uint16_t textColor = colorFromHex(props["color"] | "#ffffff", TFT_WHITE);
  const uint16_t backgroundColor = colorFromHex(
    props["backgroundColor"] | (strcmp(type, "write_button") == 0 ? "#41210f" : "#232528"),
    TFT_BLACK
  );
  const bool transparent = props["transparent"] | (strcmp(type, "write_button") != 0);
  const int logicalFontSize = constrain(props["fontSize"] | 8, 6, 32);
  const int textScale = constrain((logicalFontSize + 4) / 8, 1, 4);
  const int padding = constrain(props["padding"] | (strcmp(type, "write_button") == 0 ? 4 : 2), 0, 20);
  const int borderWidth = constrain(props["borderWidth"] | (strcmp(type, "write_button") == 0 ? 1 : 0), 0, 8);
  const int borderRadius = constrain(props["borderRadius"] | (strcmp(type, "write_button") == 0 ? 3 : 0), 0, 20);
  const uint16_t borderColor = colorFromHex(props["borderColor"] | props["color"] | "#ffffff", textColor);
  const char* horizontalAlign = props["textAlign"] | (strcmp(type, "write_button") == 0 ? "center" : "left");
  const char* verticalAlign = props["verticalAlign"] | "middle";
  M5.Display.setTextSize(textScale);
  M5.Display.setTextColor(textColor);
  if (!transparent) {
    if (borderRadius > 0) M5.Display.fillRoundRect(x, y, width, height, borderRadius, backgroundColor);
    else M5.Display.fillRect(x, y, width, height, backgroundColor);
    M5.Display.setTextColor(textColor, backgroundColor);
  }
  for (int inset = 0; inset < borderWidth; inset++) {
    if (borderRadius > 0) M5.Display.drawRoundRect(x + inset, y + inset, width - inset * 2, height - inset * 2, max(0, borderRadius - inset), borderColor);
    else M5.Display.drawRect(x + inset, y + inset, width - inset * 2, height - inset * 2, borderColor);
  }

  const char* tag = props["tag"] | "";
  JsonVariantConst value = values_[tag]["value"];
  auto valueText = [&]() -> String {
    if (value.isNull()) return String("--");
    if (value.is<const char*>()) return String(value.as<const char*>());
    String text;
    serializeJson(value, text);
    return text;
  };
  auto setAlignedCursor = [&](const String& text, int extraLeft = 0) {
    const int availableWidth = max(0, width - padding * 2 - extraLeft);
    const int textWidth = M5.Display.textWidth(text);
    int textX = x + padding + extraLeft;
    if (strcmp(horizontalAlign, "center") == 0) textX += max(0, (availableWidth - textWidth) / 2);
    else if (strcmp(horizontalAlign, "right") == 0) textX += max(0, availableWidth - textWidth);
    int textY = y + padding;
    const int textHeight = 8 * textScale;
    if (strcmp(verticalAlign, "middle") == 0) textY = y + max(padding, (height - textHeight) / 2);
    else if (strcmp(verticalAlign, "bottom") == 0) textY = y + max(padding, height - padding - textHeight);
    M5.Display.setCursor(textX, textY);
  };

  if (strcmp(type, "progress_bar") == 0) {
    const float minimum = props["min"] | 0.0f;
    const float maximum = props["max"] | 100.0f;
    const float numeric = value.isNull() ? minimum : value.as<float>();
    const float ratio = maximum > minimum ? constrain((numeric - minimum) / (maximum - minimum), 0.0f, 1.0f) : 0.0f;
    const int railX = x + padding;
    const int railY = y + padding;
    const int railWidth = max(1, width - padding * 2);
    const int railHeight = max(1, height - padding * 2);
    const int railRadius = min(borderRadius, railHeight / 2);
    M5.Display.fillRoundRect(railX, railY, railWidth, railHeight, railRadius, colorFromHex("#34373c", TFT_DARKGREY));
    M5.Display.fillRoundRect(railX, railY, max(1, static_cast<int>(railWidth * ratio)), railHeight, railRadius, textColor);
    if (props["showValue"] | true) {
      const String text = valueText();
      setAlignedCursor(text);
      M5.Display.print(text);
    }
  } else if (strcmp(type, "gauge") == 0) {
    const float minimum = props["min"] | 0.0f;
    const float maximum = props["max"] | 100.0f;
    const float numeric = value.isNull() ? minimum : value.as<float>();
    const float ratio = maximum > minimum ? constrain((numeric - minimum) / (maximum - minimum), 0.0f, 1.0f) : 0.0f;
    const int radius = max(6, min((width - padding * 2) / 2, height - padding * 2));
    const int centerX = x + width / 2;
    const int centerY = min(y + height - padding, y + padding + radius);
    M5.Display.drawArc(centerX, centerY, radius, max(1, radius - 4), 180, 360, colorFromHex("#34373c", TFT_DARKGREY));
    M5.Display.drawArc(centerX, centerY, radius, max(1, radius - 4), 180, 180 + static_cast<int>(180 * ratio), textColor);
    if (props["showValue"] | true) {
      const String text = valueText();
      const int textX = centerX - M5.Display.textWidth(text) / 2;
      M5.Display.setCursor(textX, max(y + padding, centerY - 8 * textScale));
      M5.Display.print(text);
    }
  } else if (strcmp(type, "boolean_indicator") == 0) {
    const int radius = max(3, 3 * textScale);
    M5.Display.fillCircle(x + padding + radius, y + height / 2, radius, value.as<bool>() ? TFT_GREEN : TFT_RED);
    const String text = props["label"] | tag;
    setAlignedCursor(text, radius * 2 + 4);
    M5.Display.print(text);
  } else {
    String text;
    if (strcmp(type, "static_text") == 0 || strcmp(type, "status_indicator") == 0) text = String(props["text"] | "");
    else if (strcmp(type, "write_button") == 0) text = String(props["text"] | "Escrever");
    else text = valueText();
    setAlignedCursor(text);
    M5.Display.print(text);
  }
  M5.Display.setTextSize(1);
}

String LinkPadRuntime::baseUrl() const {
  String result = "http://";
  result += config_["agent"]["host"].as<const char*>();
  result += ":";
  result += String(config_["agent"]["port"] | 8008);
  return result;
}
