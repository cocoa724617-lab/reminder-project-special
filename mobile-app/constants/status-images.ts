import type { ImageSourcePropType } from "react-native";

import type { StatusKey } from "@/utils/user-status-utils";

// utils/user-status-utils.ts の STATUS_DEFINITIONS[key].image はファイル名の文字列（例: "normal_mode.png"）
// しか持たない（Web版はブラウザが直接そのパスを画像として読めたが、RNではrequire()で静的に
// バンドルする必要があるため）。ここに集約したマップを、現在のステータスカード・ステータス発見度グリッド・
// セレブレーショントーストの3箇所すべてから参照する（画像ファイル名→requireの対応を1箇所にまとめるため）。
export const STATUS_IMAGES: Record<StatusKey, ImageSourcePropType> = {
  selfManagementMaster: require("@/assets/images/status/self_management_master.png"),
  routineMaster: require("@/assets/images/status/routine_master.png"),
  lazyPerson: require("@/assets/images/status/lazy_person.png"),
  procrastinationDemon: require("@/assets/images/status/procrastination_demon.png"),
  forgetfulAlien: require("@/assets/images/status/forgetful_alien.png"),
  tooBusyPerson: require("@/assets/images/status/too_busy_person.png"),
  vacationMode: require("@/assets/images/status/vacation_mode.png"),
  normalMode: require("@/assets/images/status/normal_mode.png"),
};
