#pragma once

#include <Arduino.h>

class LinkPadStatusOverlay {
 public:
  template <typename Display>
  static void render(
    Display& display,
    bool showWifi,
    bool wifiOnline,
    bool showAgent,
    bool agentOnline,
    const char* placement
  ) {
    const int count = static_cast<int>(showWifi) + static_cast<int>(showAgent);
    if (count == 0) return;

    const int width = display.width();
    const int height = display.height();
    const int shortSide = width < height ? width : height;
    const int iconSize = clamp(shortSide / 10, 10, 18);
    const int margin = clamp(shortSide / 45, 2, 6);
    const int gap = clamp(iconSize / 3, 3, 6);
    const int totalWidth = count * iconSize + (count - 1) * gap;
    const bool alignRight = strcmp(placement, "top-right") == 0 || strcmp(placement, "bottom-right") == 0;
    const bool alignBottom = strcmp(placement, "bottom-left") == 0 || strcmp(placement, "bottom-right") == 0;
    int x = alignRight ? width - margin - totalWidth : margin;
    const int y = alignBottom ? height - margin - iconSize : margin;

    if (showWifi) {
      drawWifi(display, x, y, iconSize, statusColor(wifiOnline));
      x += iconSize + gap;
    }
    if (showAgent) {
      drawAgent(display, x, y, iconSize, statusColor(agentOnline));
    }
  }

 private:
  static int clamp(int value, int minimum, int maximum) {
    if (value < minimum) return minimum;
    if (value > maximum) return maximum;
    return value;
  }

  static uint16_t statusColor(bool online) {
    return online ? 0x05E0 : 0xC800;
  }

  template <typename Display>
  static void drawWifi(Display& display, int x, int y, int size, uint16_t color) {
    const int centerX = x + size / 2;
    const int outerY = y + (size * 6) / 10;
    const int innerY = y + (size * 7) / 10;
    display.drawLine(x + 1, outerY, centerX, y + 1, color);
    display.drawLine(centerX, y + 1, x + size - 2, outerY, color);
    display.drawLine(centerX - size / 4, innerY, centerX, y + size / 2, color);
    display.drawLine(centerX, y + size / 2, centerX + size / 4, innerY, color);
    display.fillCircle(centerX, y + size - 2, clamp(size / 10, 1, 2), color);
  }

  template <typename Display>
  static void drawAgent(Display& display, int x, int y, int size, uint16_t color) {
    const int radius = clamp(size / 5, 2, 4);
    const int centerY = y + size / 2;
    const int leftX = x + radius + 1;
    const int rightX = x + size - radius - 1;
    display.drawCircle(leftX, centerY, radius, color);
    display.drawCircle(rightX, centerY, radius, color);
    display.drawLine(leftX + radius, centerY, rightX - radius, centerY, color);
    display.fillCircle(leftX, centerY, 1, color);
    display.fillCircle(rightX, centerY, 1, color);
  }
};
