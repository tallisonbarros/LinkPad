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
    primaryPressed_ = M5.BtnA.wasPressed();
    secondaryPressed_ = M5.BtnB.wasPressed();
  }

  bool next(LinkPadInputEvent& output) {
    if (primaryPressed_) {
      primaryPressed_ = false;
      output = {"primary", "press"};
      return true;
    }
    if (secondaryPressed_) {
      secondaryPressed_ = false;
      output = {"secondary", "press"};
      return true;
    }
    return false;
  }

 private:
  bool primaryPressed_ = false;
  bool secondaryPressed_ = false;
};
