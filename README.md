<div align="center">

# FriendsLy

**A privacy-first, intent-driven social platform for spontaneous real-world meetups.**

![React](https://img.shields.io/badge/React-18-blue?style=flat\&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat\&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5-purple?style=flat\&logo=vite)
![Supabase](https://img.shields.io/badge/Supabase-Backend-green?style=flat\&logo=supabase)

</div>

---

## About

FriendsLy is a privacy-focused social platform designed to help people connect through shared interests and spontaneous activities without continuous GPS tracking or precise location sharing.

Instead of broadcasting exact locations, users share their intentions, moods, and activity preferences, enabling meaningful real-world interactions while maintaining privacy.

This project was developed as part of coursework for **Software Engineering** and **Human-Computer Interaction (HCI)**.

---

## Core Features

| Feature                  | Description                                                                    |
| ------------------------ | ------------------------------------------------------------------------------ |
| 🔥 Social Aura           | Broadcast temporary moods, interests, and intentions with customizable visuals |
| ✨ Serendipity Engine     | Smart recommendations for spontaneous social activities                        |
| 📦 Hangout Capsules      | Shared digital memories including photos, reflections, and experiences         |
| 🔒 Secure Messaging      | End-to-end encrypted conversations and ephemeral group chats                   |
| 📍 Approximate Proximity | Discover nearby users without revealing exact locations                        |
| 🛡️ Privacy Controls     | Visibility management, trusted contacts, blocking, and reporting tools         |

---

## Tech Stack

| Category              | Technology               |
| --------------------- | ------------------------ |
| Frontend              | React 18                 |
| Language              | TypeScript               |
| Build Tool            | Vite                     |
| Styling               | Tailwind CSS             |
| UI Components         | shadcn/ui + Radix UI     |
| Routing               | React Router             |
| State & Data Fetching | React Query              |
| Forms & Validation    | React Hook Form + Zod    |
| Backend Services      | Supabase                 |
| Maps                  | Leaflet                  |
| Testing               | Vitest + Testing Library |

---

## Getting Started

### Prerequisites

Make sure you have:

* Node.js (v18 or later recommended)
* npm
* Git

### Clone the Repository

```bash
git clone https://github.com/Shawaiz788/FriendsLy.git
cd FriendsLy
```

### Install Dependencies

```bash
npm install
```

### Environment Variables

Create a `.env` file in the root directory and add the required environment variables.

Example:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> Replace these values with your actual Supabase project credentials.

### Start the Development Server

```bash
npm run dev
```

The application will be available at:

```text
http://localhost:5173
```

---

## Available Scripts

### Start Development Server

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

### Build in Development Mode

```bash
npm run build:dev
```

### Preview Production Build

```bash
npm run preview
```

### Run Tests

```bash
npm run test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Lint Code

```bash
npm run lint
```

---

## Project Goals

### Software Engineering

* Software Requirements Specification (SRS)
* Functional and Non-Functional Requirements
* System Design and Architecture
* Testing and Quality Assurance

### Human-Computer Interaction

* User Research
* Accessibility Considerations
* Interface Prototyping
* User Experience Design

---

## Performance Targets

| Metric                        | Target      |
| ----------------------------- | ----------- |
| Standard Action Response Time | < 2 seconds |
| Aura Matching Latency         | < 5 seconds |
| User Onboarding Completion    | < 3 minutes |
| Data Backup Frequency         | Daily       |

---

## Future Enhancements

* Enhanced AI-powered activity recommendations
* Improved social discovery algorithms
* Expanded privacy customization options
* Advanced group planning features
* Cross-platform notification support

---

## Author

**Shawaiz**

GitHub: https://github.com/Shawaiz788

---

## License

This project is developed for academic and educational purposes.
