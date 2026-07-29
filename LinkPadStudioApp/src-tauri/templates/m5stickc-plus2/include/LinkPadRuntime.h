#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include "LinkPadInputAdapter.h"

enum class LinkPadState {
  Booting,
  NetworkConnecting,
  AgentOffline,
  AgentOnline,
  SessionOpening,
  TargetOnline,
  TagStale,
  WriteFailed
};

class LinkPadRuntime {
 public:
  explicit LinkPadRuntime(const char* projectJson);
  void begin();
  void update();

 private:
  bool ensureNetwork();
  bool checkAgent();
  void ensureSessions();
  bool openSession(JsonObjectConst profile);
  bool readTags(JsonObjectConst profile);
  bool handleInput(const LinkPadInputEvent& input);
  bool executeAction(JsonObjectConst action);
  bool writeWidget(JsonObjectConst widget);
  bool changeTagValue(JsonObjectConst action);
  bool writeTagValue(const char* tagName, JsonVariantConst value);
  bool writeInternalTag(JsonObjectConst tag, JsonVariantConst value);
  bool internalValueAllowed(JsonObjectConst tag, JsonVariantConst value) const;
  void initializeInternalTags();
  void retainInternalValue(JsonObjectConst tag, JsonVariantConst value);
  void flushRetainedValues(bool force = false);
  int request(const String& method, const String& path, const String& body, String& response);
  JsonObject connectorStateFor(const char* profileId);
  String sessionFor(const char* profileId) const;
  void markProfileTagsQuality(const char* profileId, const char* quality);
  void invalidateSession(const char* profileId);
  void refreshState();
  size_t enabledConnectorCount() const;
  size_t onlineConnectorCount() const;
  bool tagsHealthy() const;
  void render();
  void renderStatusOverlay();
  void renderWidget(JsonObjectConst widget);
  String baseUrl() const;

  const char* projectJson_;
  DynamicJsonDocument config_{24576};
  DynamicJsonDocument values_{8192};
  DynamicJsonDocument connectorStates_{8192};
  DynamicJsonDocument retainedValues_{8192};
  Preferences preferences_;
  LinkPadInputAdapter inputAdapter_;
  LinkPadState state_ = LinkPadState::Booting;
  bool agentOnline_ = false;
  uint32_t lastPollAt_ = 0;
  uint32_t retryAt_ = 0;
  uint32_t retentionDueAt_ = 0;
  uint32_t requestSequence_ = 0;
  size_t currentScreen_ = 0;
  bool preferencesReady_ = false;
  bool retentionDirty_ = false;
};
