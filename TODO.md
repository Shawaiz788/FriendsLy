# Fix HomePage Debug Error (ERR_CONNECTION_REFUSED port 7565)

## Status: 🚧 In Progress

### Step 1: [DONE] Create TODO.md
### Step 2: [PENDING] Edit src/modules/location-suggestion/pages/HomePage.tsx
   - Remove 2 debug `fetch` blocks to localhost:7565
### Step 3: [PENDING] Edit backend/src/modules/user-management/controllers/UserController.js  
   - Remove 2 debug `fetch` blocks to localhost:7565
### Step 4: [PENDING] Test
   - Hard refresh browser (Ctrl+Shift+R)
   - Load homepage, wait 30s
   - Check dev tools Network/Console → No 7565 errors
### Step 5: [PENDING] Backend restart (if running)
   - `cd backend && npm start` (or your start command)
### Step 6: [PENDING] Complete task

