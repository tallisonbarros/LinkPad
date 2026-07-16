#include <Arduino.h>
#include "LinkPadRuntime.h"
#include "generated_project.h"

LinkPadRuntime runtime(LINKPAD_PROJECT_JSON);

void setup() {
  runtime.begin();
}

void loop() {
  runtime.update();
  delay(10);
}
