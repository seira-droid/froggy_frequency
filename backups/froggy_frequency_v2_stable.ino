/*
  Froggy Frequency - ULTRA STABLE VERSION
  ---------------------------------------
  - High Volume Threshold: Ignores background static.
  - Zero-Crossing Deadzone: Prevents "flicker" jumps.
*/

int micPin = A0;
const int pins[] = {7, 8, 9, 10}; 

const int sampleWindow = 50; 
int adaptiveMidpoint = 512;
const int deadzone = 8; // Ignores tiny fluctuations around the midpoint

void setup() {
  for(int i=0; i<4; i++) {
    pinMode(pins[i], OUTPUT);
    digitalWrite(pins[i], LOW);
  }
  Serial.begin(115200);
  
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
    
    // Only count as a crossing if it significantly crosses the midpoint
    if ((lastValue < (adaptiveMidpoint - deadzone) && currentValue > (adaptiveMidpoint + deadzone)) ||
        (lastValue > (adaptiveMidpoint + deadzone) && currentValue < (adaptiveMidpoint - deadzone))) {
      crossings++;
      lastValue = currentValue; 
    }
  }

  int peakToPeak = maxSignal - minSignal;

  if (sampleCount > 0) {
    int currentAvg = sampleSum / sampleCount;
    adaptiveMidpoint = (adaptiveMidpoint * 0.9) + (currentAvg * 0.1);
  }

  // REQUIRE SIGNIFICANT VOLUME
  if (peakToPeak < 60) {
    crossings = 0;
  }

  Serial.print("FREQ:");
  Serial.println(crossings);

  digitalWrite(pins[0], (crossings >= 18) ? HIGH : LOW);
  digitalWrite(pins[1], (crossings >= 35) ? HIGH : LOW);
  digitalWrite(pins[2], (crossings >= 55) ? HIGH : LOW);
  digitalWrite(pins[3], (crossings >= 80) ? HIGH : LOW);

  delay(5); 
}
