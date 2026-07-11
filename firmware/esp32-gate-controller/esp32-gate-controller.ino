#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include "config.h"

unsigned long lastPollAt = 0;

void setRelay(bool on) {
  if (RELAY_ACTIVE_HIGH) {
    digitalWrite(RELAY_PIN, on ? HIGH : LOW);
  } else {
    digitalWrite(RELAY_PIN, on ? LOW : HIGH);
  }
}

void pulseGateRelay() {
  Serial.println("OPEN_GATE pulse");
  setRelay(true);
  delay(RELAY_PULSE_MS);
  setRelay(false);
}

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));
    delay(500);
  }

  digitalWrite(STATUS_LED_PIN, HIGH);
}

void pollGateCommand() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
    return;
  }

  HTTPClient http;
  String url = String(API_BASE_URL) + "/gate/" + GATE_ID + "/command";

  http.begin(url);
  int statusCode = http.GET();
  String payload = http.getString();
  http.end();

  if (statusCode == 200 && payload.indexOf("OPEN_GATE") >= 0) {
    pulseGateRelay();
  }
}

void setup() {
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(MANUAL_OVERRIDE_PIN, INPUT_PULLUP);
  pinMode(GATE_CLOSED_SENSOR_PIN, INPUT_PULLUP);
  pinMode(STATUS_LED_PIN, OUTPUT);

  setRelay(false);
  digitalWrite(STATUS_LED_PIN, LOW);

  Serial.begin(115200);
  connectWifi();
}

void loop() {
  if (digitalRead(MANUAL_OVERRIDE_PIN) == LOW) {
    pulseGateRelay();
    delay(1000);
  }

  unsigned long now = millis();
  if (now - lastPollAt >= POLL_INTERVAL_MS) {
    lastPollAt = now;
    pollGateCommand();
  }
}
