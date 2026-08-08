import type { SyncPlan } from "../sync/types";
import { summarizePlan } from "../sync/types";
import {
  DELETE_WARNING_COUNT,
  DELETE_WARNING_PERCENTAGE
} from "./settings";

export function isMassDeletion(plan: SyncPlan): boolean {
  const deleted = summarizePlan(plan).deleted;
  const ratio = plan.destinationFileCount === 0
    ? 0
    : deleted / plan.destinationFileCount;
  return deleted > DELETE_WARNING_COUNT || ratio > DELETE_WARNING_PERCENTAGE;
}
