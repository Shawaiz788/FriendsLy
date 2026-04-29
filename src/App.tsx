import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import Welcome from "./modules/auth/pages/Welcome";
import Login from "./modules/auth/pages/Login";
import SignUp from "./modules/auth/pages/SignUp";
import HomePage from "./modules/location-suggestion/pages/HomePage";
import FriendsPage from "./modules/friends-interaction/pages/FriendsPage";
import IntentPage from "./modules/intent-aura/pages/IntentPage";
import NotificationsPage from "./modules/safety-emergency/pages/NotificationsPage";
import SettingsPage from "./modules/user-account/pages/SettingsPage";
import SearchPage from "./modules/friends-interaction/pages/SearchPage";
import SocialPage from "./modules/content-creation/pages/SocialPage";
import MediaPage from "./modules/content-creation/pages/MediaPage";
import UserProfilePage from "./modules/user-account/pages/UserProfilePage";
import NotFound from "./modules/core/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/intent" element={<IntentPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile" element={<Navigate to="/settings" replace />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/social" element={<SocialPage />} />
          <Route path="/media" element={<MediaPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/user/:userId" element={<UserProfilePage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;