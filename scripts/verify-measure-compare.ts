import {
  formatDisplayedMeasure,
  hasEnoughMeasure,
  prefsFromSystem,
  toDisplayMeasure,
} from "../src/lib/formatMeasure";
import { formatUnit } from "../src/lib/formatUnit";

const us = prefsFromSystem("us");
const ko = prefsFromSystem("ko");

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(hasEnoughMeasure(0.33, "cup", 1 / 3, "cup", us), "0.33 cup should cover 1/3 cup");
assert(hasEnoughMeasure(0.33, "컵", 1 / 3, "cup", ko), "0.33 컵 should cover 1/3 cup");
assert(!hasEnoughMeasure(0.32, "cup", 1 / 3, "cup", us), "0.32 cup should be short of 1/3 cup");

const needDisplay = toDisplayMeasure(1 / 3, "cup", us);
assert(needDisplay.amount === 0.33, `1/3 cup should display as 0.33, got ${needDisplay.amount}`);
assert(needDisplay.unit === "cup", `1/3 cup should display in cups, got ${needDisplay.unit}`);

assert(hasEnoughMeasure(240, "ml", 1, "cup", us), "240 ml should cover 1 cup");
assert(hasEnoughMeasure(1, "cup", 240, "ml", ko), "1 cup should cover 240 ml");
assert(!hasEnoughMeasure(200, "ml", 1, "cup", us), "200 ml should be short of 1 cup");
assert(hasEnoughMeasure(15, "ml", 1, "tbsp", us), "15 ml should cover 1 tbsp");
assert(hasEnoughMeasure(1, "큰술", 15, "ml", ko), "1 큰술 should cover 15 ml");

assert(hasEnoughMeasure(0, "cup", 0, "cup", us), "zero need should not warn");
assert(hasEnoughMeasure(0, "to taste", 2, "to taste", us), "to taste should not warn");
assert(!hasEnoughMeasure(1, "cup", 100, "g", us), "volume vs mass should stay short");

assert(formatUnit("cups", "en") === "cup", "English cups should normalize to cup");
assert(formatUnit("컵", "en") === "cup", "Korean cup should map to cup in English");
assert(formatUnit("cup", "ko") === "컵", "English cup should map to 컵");
assert(formatUnit("tbsp", "ko") === "큰술", "tbsp should map to 큰술");
assert(formatUnit("큰술", "en") === "tbsp", "큰술 should map to tbsp");

const shown = formatDisplayedMeasure(1 / 3, "cup", ko, "ko");
assert(shown.includes("0.33"), `Korean display should include 0.33, got ${shown}`);
assert(shown.includes("컵"), `Korean display should include 컵, got ${shown}`);

console.log("Measure compare boundary checks passed.");
