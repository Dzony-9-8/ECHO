// Branch management via localStorage
import type { BranchInfo } from "@/components/BranchIndicator";

const STORAGE_KEY = "echo_branches";

export const getBranches = (): BranchInfo[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

export const saveBranch = (branch: BranchInfo) => {
  const all = getBranches();
  all.push(branch);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
};

export const deleteBranch = (conversationId: string) => {
  const all = getBranches().filter((b) => b.conversationId !== conversationId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
};

export const getBranchesForMessage = (messageId: string): BranchInfo[] => {
  return getBranches().filter((b) => b.branchMessageId === messageId);
};

export const getBranchesForConversation = (conversationId: string): BranchInfo[] => {
  return getBranches().filter((b) => b.parentConversationId === conversationId);
};

export const getParentBranch = (conversationId: string): BranchInfo | undefined => {
  return getBranches().find((b) => b.conversationId === conversationId);
};
