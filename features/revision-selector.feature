Feature: Revision selectors

  Scenario: Hide empty local states and show branch provenance labels
    Given a clean git review repo
    When I open Reviewer for the active repo
    And I open the "head" revision selector
    Then the open selector should not show local change entries
    And the open selector should include branch "feat/local-only"
    And the open selector should include branch "fix/pushed@origin"

  Scenario: Show staging area before working tree
    Given a git review repo with staged and unstaged changes
    When I open Reviewer for the active repo
    And I open the "head" revision selector
    Then "Staging area" should appear before "Working tree" in the open selector
    And the timeline should list "Staging area" before "Working tree"