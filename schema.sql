-- ============================================
-- FRIENDSLY DATABASE - SUPABASE READY
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- USERS & ACCOUNT MANAGEMENT
-- ============================================

CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    password_hash TEXT NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    account_status VARCHAR(20) DEFAULT 'active'
        CHECK (account_status IN ('active','deactivated','deleted','suspended')),
    data_retention_preference VARCHAR(50) DEFAULT 'standard',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

CREATE TABLE user_profiles (
    profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    full_name VARCHAR(150) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    bio TEXT,
    profile_photo_url TEXT,
    date_of_birth DATE,
    gender VARCHAR(50),
    dark_mode_enabled BOOLEAN DEFAULT FALSE,
    selected_theme VARCHAR(50) DEFAULT 'default',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INTERESTS
-- ============================================

CREATE TABLE interests (
    interest_id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE user_interests (
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    interest_id INT REFERENCES interests(interest_id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, interest_id)
);

-- ============================================
-- SESSIONS
-- ============================================

CREATE TABLE user_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    device_info TEXT,
    ip_address INET,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- ============================================
-- FRIENDSHIPS
-- ============================================

CREATE TABLE friendships (
    friendship_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    addressee_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending','accepted','blocked')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- HANGOUT INTENTS
-- ============================================

CREATE TABLE hangout_intents (
    intent_id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    icon VARCHAR(50)
);

-- ============================================
-- AURAS
-- ============================================

CREATE TABLE auras (
    aura_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    intent_id INT REFERENCES hangout_intents(intent_id),
    custom_intent_text VARCHAR(255),
    color VARCHAR(50),
    emoji VARCHAR(10),
    glow_effect VARCHAR(50),
    approximate_location POINT,
    proximity_radius INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE TABLE aura_interactions (
    interaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aura_id UUID REFERENCES auras(aura_id) ON DELETE CASCADE,
    responder_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    action VARCHAR(20)
        CHECK (action IN ('accept','decline','snooze')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- SERENDIPITY ENGINE
-- ============================================

CREATE TABLE serendipity_suggestions (
    suggestion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    suggested_user_id UUID REFERENCES users(user_id),
    reasoning TEXT,
    proximity_score FLOAT,
    interest_match_score FLOAT,
    accepted BOOLEAN,
    opted_out BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- HANGOUTS
-- ============================================

CREATE TABLE hangouts (
    hangout_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES users(user_id),
    intent_id INT REFERENCES hangout_intents(intent_id),
    title VARCHAR(255),
    description TEXT,
    location POINT,
    scheduled_time TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending','confirmed','completed','cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE hangout_participants (
    hangout_id UUID REFERENCES hangouts(hangout_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'invited'
        CHECK (status IN ('invited','accepted','declined')),
    PRIMARY KEY (hangout_id, user_id)
);

-- ============================================
-- GROUP CHATS
-- ============================================

CREATE TABLE group_chats (
    group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hangout_id UUID REFERENCES hangouts(hangout_id),
    is_temporary BOOLEAN DEFAULT TRUE,
    auto_delete_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE group_members (
    group_id UUID REFERENCES group_chats(group_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member',
    PRIMARY KEY (group_id, user_id)
);

-- ============================================
-- MESSAGES (E2E READY)
-- ============================================

CREATE TABLE messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES group_chats(group_id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(user_id),
    encrypted_payload TEXT NOT NULL,
    message_type VARCHAR(20)
        CHECK (message_type IN ('text','voice','poll')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- POLLS
-- ============================================

CREATE TABLE polls (
    poll_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES group_chats(group_id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    created_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE poll_options (
    option_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID REFERENCES polls(poll_id) ON DELETE CASCADE,
    option_text TEXT NOT NULL
);

CREATE TABLE poll_votes (
    poll_id UUID REFERENCES polls(poll_id) ON DELETE CASCADE,
    option_id UUID REFERENCES poll_options(option_id),
    user_id UUID REFERENCES users(user_id),
    PRIMARY KEY (poll_id, user_id)
);

-- ============================================
-- STORIES (24H)
-- ============================================

CREATE TABLE stories (
    story_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    media_url TEXT,
    media_type VARCHAR(20)
        CHECK (media_type IN ('image','video')),
    visibility VARCHAR(20) DEFAULT 'friends'
        CHECK (visibility IN ('friends','close_friends','public')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- ============================================
-- POSTS
-- ============================================

CREATE TABLE posts (
    post_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    content TEXT,
    media_url TEXT,
    media_type VARCHAR(20),
    visibility VARCHAR(20) DEFAULT 'friends'
        CHECK (visibility IN ('friends','close_friends','public')),
    is_collaborative BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE post_collaborators (
    post_id UUID REFERENCES posts(post_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, user_id)
);

-- ============================================
-- CAPSULES
-- ============================================

CREATE TABLE capsules (
    capsule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hangout_id UUID REFERENCES hangouts(hangout_id),
    summary TEXT,
    auto_generated BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE capsule_media (
    media_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    capsule_id UUID REFERENCES capsules(capsule_id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES users(user_id),
    media_url TEXT,
    media_type VARCHAR(20)
        CHECK (media_type IN ('image','video','audio')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE capsule_reflections (
    reflection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    capsule_id UUID REFERENCES capsules(capsule_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id),
    reflection_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- DISCOVERY
-- ============================================

CREATE TABLE trending_activities (
    trend_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location POINT,
    activity_name VARCHAR(255),
    popularity_score FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PRIVACY & SAFETY
-- ============================================

CREATE TABLE trusted_contacts (
    contact_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    contact_user_id UUID REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE blocks (
    blocker_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    blocked_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE reports (
    report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES users(user_id),
    reported_user_id UUID REFERENCES users(user_id),
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    type VARCHAR(50),
    reference_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- DATA EXPORT & AUDIT
-- ============================================

CREATE TABLE data_exports (
    export_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    file_url TEXT
);

CREATE TABLE audit_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    action_type VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES (Performance)
-- ============================================

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_auras_active ON auras(is_active);
CREATE INDEX idx_hangouts_status ON hangouts(status);
CREATE INDEX idx_messages_group ON messages(group_id);
CREATE INDEX idx_stories_expiry ON stories(expires_at);
CREATE INDEX idx_notifications_user ON notifications(user_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on friendships table
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- Allow users to see incoming friend requests (where they are addressee)
CREATE POLICY "Users can view incoming friend requests"
ON friendships
FOR SELECT
USING (addressee_id = auth.uid());

-- Allow users to see outgoing friend requests (where they are requester)
CREATE POLICY "Users can view outgoing friend requests"
ON friendships
FOR SELECT
USING (requester_id = auth.uid());

-- Allow authenticated users to insert (send friend requests)
CREATE POLICY "Authenticated users can send friend requests"
ON friendships
FOR INSERT
WITH CHECK (requester_id = auth.uid());

-- Allow users to update their incoming requests (accept/reject)
CREATE POLICY "Users can update their incoming friend requests"
ON friendships
FOR UPDATE
USING (addressee_id = auth.uid());

-- Allow users to delete their requests
CREATE POLICY "Users can delete friend requests they initiated"
ON friendships
FOR DELETE
USING (requester_id = auth.uid() OR addressee_id = auth.uid());

-- Enable RLS on user_profiles table for public viewing
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read public profiles
CREATE POLICY "Anyone can view user profiles"
ON user_profiles
FOR SELECT
USING (true);

-- Allow users to update only their own profile
CREATE POLICY "Users can update their own profile"
ON user_profiles
FOR UPDATE
USING (user_id = auth.uid());

-- Allow users to insert only their own profile
CREATE POLICY "Users can insert their own profile"
ON user_profiles
FOR INSERT
WITH CHECK (user_id = auth.uid());

