#pragma once

#include <M5Unified.h>

struct LinkPadInputEvent {
  const char* inputId;
  const char* event;
};

class LinkPadInputAdapter {
 public:
  void update() {
    M5.update();
    primaryPressed_ = M5.BtnA.wasClicked();
    primaryLongPressed_ = M5.BtnA.wasHold();
    secondaryPressed_ = M5.BtnB.wasClicked();
    secondaryLongPressed_ = M5.BtnB.wasHold();
    powerPressed_ = M5.BtnPWR.wasClicked();
    powerLongPressed_ = M5.BtnPWR.wasHold();
  }

  bool next(LinkPadInputEvent& output) {
    if (primaryLongPressed_) {
      primaryLongPressed_ = false;
      output = {"primary", "longPress"};
      return true;
    }
    if (primaryPressed_) {
      primaryPressed_ = false;
      output = {"primary", "press"};
      return true;
    }
    if (secondaryLongPressed_) {
      secondaryLongPressed_ = false;
      output = {"secondary", "longPress"};
      return true;
    }
    if (secondaryPressed_) {
      secondaryPressed_ = false;
      output = {"secondary", "press"};
      return true;
    }
    if (powerLongPressed_) {
      powerLongPressed_ = false;
      output = {"power", "longPress"};
      return true;
    }
    if (powerPressed_) {
      powerPressed_ = false;
      output = {"power", "press"};
      return true;
    }
    return false;
  }

 private:
  bool primaryPressed_ = false;
  bool primaryLongPressed_ = false;
  bool secondaryPressed_ = false;
  bool secondaryLongPressed_ = false;
  bool powerPressed_ = false;
  bool powerLongPressed_ = false;
};
