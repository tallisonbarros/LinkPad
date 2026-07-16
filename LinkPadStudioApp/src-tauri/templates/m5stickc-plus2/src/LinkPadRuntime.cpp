#include "LinkPadRuntime.h"
#include "LinkPadStatusOverlay.h"

#include <HTTPClient.h>
#include <M5Unified.h>
#include <WiFi.h>

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

  WiFi.mode(WIFI_STA);
  state_ = LinkPadState::NetworkConnecting;
  render();
}

void LinkPadRuntime::update() {
  M5.update();
  if (M5.BtnA.wasPressed()) {
    const size_t count = config_["screens"].size();
    if (count > 0) currentScreen_ = (currentScreen_ + 1) % count;
    render();
  }
  if (M5.BtnB.wasPressed()) {
    writeFromCurrentScreen();
    render();
  }

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
    return false;
  }
  const String sessionId = parsed["sessionId"].as<String>();
  connectorState["sessionId"] = sessionId;
  connectorState["tagsGood"] = !sessionId.isEmpty();
  connectorState["retryAt"] = sessionId.isEmpty() ? millis() + 2000 : 0;
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
    if (code <= 0) {
      agentOnline_ = false;
      retryAt_ = millis() + 2000;
    }
    return false;
  }

  DynamicJsonDocument parsed(8192);
  if (deserializeJson(parsed, response)) {
    connectorState["tagsGood"] = false;
    return false;
  }
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

bool LinkPadRuntime::writeFromCurrentScreen() {
  JsonArrayConst screens = config_["screens"].as<JsonArrayConst>();
  if (currentScreen_ >= screens.size()) return false;
  JsonObjectConst screen = screens[currentScreen_];
  for (JsonObjectConst widget : screen["widgets"].as<JsonArrayConst>()) {
    if (strcmp(widget["type"] | "", "write_button") != 0) continue;
    const char* tagName = widget["props"]["tag"] | "";
    for (JsonObjectConst tag : config_["tags"].as<JsonArrayConst>()) {
      if (strcmp(tag["name"] | "", tagName) != 0) continue;
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
      write["value"] = widget["props"]["value"];
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
  }
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

void LinkPadRuntime::invalidateSession(const char* profileId) {
  if (profileId == nullptr || strlen(profileId) == 0) return;
  JsonObject connectorState = connectorStateFor(profileId);
  connectorState["sessionId"] = "";
  connectorState["tagsGood"] = false;
  connectorState["retryAt"] = millis() + 1000;
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
  M5.Display.setCursor(x, y);
  M5.Display.setTextColor(TFT_WHITE, TFT_BLACK);
  if (strcmp(type, "static_text") == 0 || strcmp(type, "status_indicator") == 0) {
    M5.Display.print(widget["props"]["text"] | "");
  } else if (strcmp(type, "write_button") == 0) {
    M5.Display.drawRoundRect(x, y, width, height, 3, TFT_ORANGE);
    M5.Display.setCursor(x + 4, y + 5);
    M5.Display.print(widget["props"]["text"] | "Escrever");
  } else {
    const char* tag = widget["props"]["tag"] | "";
    JsonVariantConst value = values_[tag]["value"];
    if (strcmp(type, "boolean_indicator") == 0) {
      M5.Display.fillCircle(x + 5, y + 7, 4, value.as<bool>() ? TFT_GREEN : TFT_RED);
      M5.Display.setCursor(x + 13, y);
      M5.Display.print(tag);
    } else {
      M5.Display.print(tag);
      M5.Display.print(": ");
      if (value.isNull()) M5.Display.print("--");
      else serializeJson(value, M5.Display);
    }
  }
}

String LinkPadRuntime::baseUrl() const {
  String result = "http://";
  result += config_["agent"]["host"].as<const char*>();
  result += ":";
  result += String(config_["agent"]["port"] | 8008);
  return result;
}
