##  Here the link of the demo so you can play with it 
https://www.figma.com/proto/br5W2BOY2BH8gzCXCm5tUC/transendence?node-id=214-2056&t=HX1f7vMrqx1ytCOn-1&scaling=scale-down&content-scaling=fixed&page-id=0%3A1&starting-point-node-id=1%3A2&show-proto-sidebar=1

# Demo Feature ↔ Subject Module Mapping

| Demo Feature | Subject Module | Points | Status | Notes |
|--------------|----------------|:------:|:------:|-------|
| Login with 42 | OAuth 2.0 Remote Authentication | 1 | ✅ | Secure authentication using the 42 Intra OAuth system with automatic account linking. |
| User Roles & Permissions | Advanced Permissions System | 2 | ✅ | Role-based access for Students, Tutors, Counsellors, Student Council, Head Tutors, and Administrators. Each role has different permissions and dashboards. |
| Tutor Dashboard | Frontend & Backend Frameworks | 2 | ✅ | Personalized dashboard displaying evaluations, announcements, notifications, shortcuts, and statistics built with React + Python. |
| Evaluation Request System | Real-Time Features | 2 | ✅ | Students create evaluation requests, tutors instantly receive updates and can claim available slots through WebSockets. |
| Notification Center | Complete Notification System | 1 | ✅ | In-app notifications for evaluation requests, announcements, role changes, uploaded resources, and Student Council activities. |
| Resource Library | File Upload & Management | 1 | ✅ | Upload, preview, download, and manage PDFs, images, documentation, and project resources with secure access control. |
| Analytics Dashboard | Advanced Analytics Dashboard | 2 | ✅ | Interactive charts showing tutor activity, evaluation statistics, demand by project, waiting times, and platform usage. |
| Organizations & Teams | Organization System | 2 | ✅ | Manage organizations such as Tutors, Counsellors, Student Council, and project-specific groups with membership management. |
| Anonymous Student Council Messages | Advanced Permissions + ORM + Notifications | - | ✅  | Students and Hitchhikers can anonymously send messages to the Student Council. Counsellors receive notifications, read messages, mark them as **Read/Unread**, archive them, and maintain a shared message history stored in the database for future reference. |
| Public Tutor & Counsellor Profiles | Standard User Management | +2 | ✅  | Public profiles including biography, projects, profile picture, role, availability, and contact information. |
| Search System | Advanced Search *(Backup Module)* | +1 | ✅  | Global search for tutors, projects, announcements, resources, and evaluation requests with advanced filtering. |
| Multi-Language Support | Internationalization *(Bonus Module)* | +1 | 💡 | Full interface available in English, Czech, Spanish, Russian, French, and other languages with a language selector and persistent user preference. |
| Dark / Light Theme | Accessibility & User Experience | - | 💡 | Users can switch between light and dark themes, with their preference automatically saved. |
| Progressive Web App (PWA) | PWA *(Bonus Module)* | +1 | 💡 | Install the platform on desktop or mobile devices with offline access to public pages. |
| Two-Factor Authentication | User Management *(Bonus Module)* | +1 | 💡 | Additional security layer for administrators, tutors, and counsellors using TOTP authentication. |
| Personal Calendar | Dashboard Feature | - | 💡 | Personal calendar displaying upcoming evaluations, meetings, events, and reminders. |
| Poll & Voting System | Organization System | - | 💡 | Student Council members can create anonymous polls and display live voting results to the community. |
| Email & Browser Notifications | Notification System | - | 💡 | Optional email and browser push notifications for important events such as evaluations, announcements, or role changes. |