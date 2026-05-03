# Media & Stories Merge + Unified Post Creation TODO

## Planned Steps:
- [x] 1. Update BottomNav.tsx: Remove Stories tab from navItems
- [x] 2. Update App.tsx: Remove /stories route  
- [x] 3. Refactor MediaPage.tsx: 
  - Add stories section at top (loadStories, stories list with thumbnails/timer)
  - Add StoryUpload and StoryDisplay modals
  - Remove inline post form
  - Replace with single "Create Post" button -> CollaborativePostCreate (unified)
- [x] 4. Generalize CollaborativePostCreate.tsx for normal/collaborative posts (collaborators optional)
- [x] 5. Delete StoriesPage.tsx
- [x] 6. Test Media tab: stories top, posts below, unified post creation with text/media/visibility/collaborators
- [x] 7. Mark complete

**Current progress: Starting step 1**
