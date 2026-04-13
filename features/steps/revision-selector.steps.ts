import { expect, Page } from "@playwright/test";
import { createBdd, test } from "playwright-bdd";
import { createGitReviewRepo, GitFixtureRepo } from "../support/git-fixtures";

const { After, Given, Then, When } = createBdd(test);

let activeRepo: GitFixtureRepo | null = null;
let activeSelector: "base" | "head" | null = null;

const getOpenSelectorMenu = (page: Page) => {
  if (!activeSelector) {
    throw new Error("No revision selector is open.");
  }

  return page.getByTestId(`${activeSelector}-revision-menu`);
};

const waitForReviewerReady = async (page: Page) => {
  await expect(page.getByRole("button", { name: "Base revision selector" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Head revision selector" })).toBeVisible();
  await page.waitForFunction(() => {
    const params = new URL(window.location.href).searchParams;
    return (
      Boolean(params.get("baseBranch")) &&
      Boolean(params.get("headBranch")) &&
      params.has("baseCommit") &&
      params.has("headCommit")
    );
  });
  await expect(page.getByText("Loading diff...")).toHaveCount(0);
};

const expectOrderedTexts = async (texts: string[], first: string, second: string) => {
  const firstIndex = texts.findIndex((text) => text.includes(first));
  const secondIndex = texts.findIndex((text) => text.includes(second));

  expect(firstIndex).toBeGreaterThanOrEqual(0);
  expect(secondIndex).toBeGreaterThanOrEqual(0);
  expect(firstIndex).toBeLessThan(secondIndex);
};

After(async () => {
  activeSelector = null;
  if (activeRepo) {
    await activeRepo.cleanup();
    activeRepo = null;
  }
});

Given("a clean git review repo", async () => {
  activeRepo = await createGitReviewRepo("clean");
});

Given("a git review repo with staged and unstaged changes", async () => {
  activeRepo = await createGitReviewRepo("with-local-changes");
});

When("I open Reviewer for the active repo", async ({ page }) => {
  if (!activeRepo) {
    throw new Error("No active repo fixture is available.");
  }

  await page.goto(`/?repoPath=${encodeURIComponent(activeRepo.repoPath)}`);
  await waitForReviewerReady(page);
});

When("I open the {string} revision selector", async ({ page }, side: string) => {
  const normalizedSide = side.toLowerCase();
  if (normalizedSide !== "base" && normalizedSide !== "head") {
    throw new Error(`Unsupported selector side: ${side}`);
  }

  activeSelector = normalizedSide;
  await page
    .getByRole("button", {
      name: `${side[0]?.toUpperCase() || ""}${side.slice(1)} revision selector`,
    })
    .click();
  await expect(getOpenSelectorMenu(page)).toBeVisible();
});

Then("the open selector should not show local change entries", async ({ page }) => {
  const menu = getOpenSelectorMenu(page);
  await expect(menu.getByText("Staging area", { exact: true })).toHaveCount(0);
  await expect(menu.getByText("Working tree", { exact: true })).toHaveCount(0);
});

Then("the open selector should include branch {string}", async ({ page }, branchName: string) => {
  await expect(
    getOpenSelectorMenu(page).locator('[role="option"]').filter({ hasText: branchName }).first(),
  ).toBeVisible();
});

Then(
  "{string} should appear before {string} in the open selector",
  async ({ page }, first: string, second: string) => {
    const texts = await getOpenSelectorMenu(page).locator('[role="option"]').allTextContents();
    await expectOrderedTexts(texts, first, second);
  },
);

Then(
  "the timeline should list {string} before {string}",
  async ({ page }, first: string, second: string) => {
    const texts = await page
      .getByRole("listbox", { name: "Commit range timeline" })
      .locator('[role="option"]')
      .allTextContents();

    await expectOrderedTexts(texts, first, second);
  },
);
