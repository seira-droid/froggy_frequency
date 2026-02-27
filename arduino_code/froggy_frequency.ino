/*
  Froggy Frequency - STABLE V3 (PRO)
  ----------------------------------
  - Synchronized Thresholds: [18, 35, 55, 80]
  - Adaptive Midpoint: Filters DC offset and static.
  - Hysteresis Logic: Prevents jump flicker.
*/

const int micPin = A0;
const int pins[] = {7, 8, 9, 10}; 

const int sampleWindow = 50; 
int adaptiveMidpoint = 512;
const int deadzone = 8; 

void setup() {
  Serial.begin(115200);
  
  for(int i=0; i<4; i++) {
    pinMode(pins[i], OUTPUT);
    digitalWrite(pins[i], LOW);
  }

  // Startup Animation
  for(int i=0; i<4; i++) {
    digitalWrite(pins[i], HIGH);
    delay(100);
    digitalWrite(pins[i], LOW);
  }
}

void loop() {
  unsigned long startTime = millis();
  int crossings = 0;
  long sampleSum = 0;
  int sampleCount = 0;
  int maxSignal = 0;
  int minSignal = 1024;
  int lastValue = analogRead(micPin);

  while (millis() - startTime < sampleWindow) {
    int currentValue = analogRead(micPin);
    sampleSum += currentValue;
    sampleCount++;
    
    if (currentValue > maxSignal) maxSignal = currentValue;
    if (currentValue < minSignal) minSignal = currentValue;
    
    // Zero-crossing detection with deadzone hysteresis
    if ((lastValue < (adaptiveMidpoint - deadzone) && currentValue > (adaptiveMidpoint + deadzone)) ||
        (lastValue > (adaptiveMidpoint + deadzone) && currentValue < (adaptiveMidpoint - deadzone))) {
      crossings++;
      lastValue = currentValue; 
    }
  }

  int peakToPeak = maxSignal - minSignal;

  // Slowly adapt midpoint to handle hardware DC drift
  if (sampleCount > 0) {
    int currentAvg = sampleSum / sampleCount;
    adaptiveMidpoint = (adaptiveMidpoint * 0.95) + (currentAvg * 0.05);
  }

  // Noise Floor Filter (Volume check)
  if (peakToPeak < 60) {
    crossings = 0;
  }

  // Frequency Output for Game
  Serial.print("FREQ:");
  Serial.println(crossings);

  // Synchronized LED Feedback & Jetpack "Pulse"
  // If frequency is sustained high (Jetpack Mode), LEDs will pulse
  bool isJetpackFreq = (crossings >= 18);
  
  digitalWrite(pins[0], (crossings >= 18) ? HIGH : LOW);
  digitalWrite(pins[1], (crossings >= 35) ? HIGH : LOW);
  digitalWrite(pins[2], (crossings >= 55) ? HIGH : LOW);
  digitalWrite(pins[3], (crossings >= 80) ? HIGH : LOW);

  // If in high-range sustained sound, add a small delay variance for "flutter" effect
  if (crossings > 50) delay(1);
  else delay(2); 
}
