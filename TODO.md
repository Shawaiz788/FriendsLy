# Fix Stories Tab - Hide Expired Stories

**Status: In Progress**

## Plan Breakdown
1. ✅ [Complete] Understand codebase (StoryController.js, StoriesPage.tsx, schema.sql)
2. ✅ [Complete] Confirm plan with user (client-side filter + auto-refresh)
3. ✅ Edit src/modules/content-creation/pages/StoriesPage.tsx 
   - Add activeStories filter
   - Update counts/rendering
   - Fix formatTimeRemaining
   - Add 5min auto-refresh
4. ✅ Edit src/components/StoryDisplay.tsx
   - Filter stories on load
   - Fix formatTimeRemaining
5. [ ] Test: Create story → verify hides after expiry
6. [ ] Update this TODO.md

**Next Step:** Edit StoriesPage.tsx
