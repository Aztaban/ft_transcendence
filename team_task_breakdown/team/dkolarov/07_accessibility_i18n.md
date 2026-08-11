# Milestone 7 — Accessibility & Internationalization

**Assigned to:** Diana (dkolarov)

## Milestone Goal (context)

Make the platform accessible and available in multiple languages.

The application should support different users regardless of language or accessibility needs.

After this milestone:

- Users can switch application language.
- Main workflows are translated.
- Interface follows accessibility standards.
- Evaluation workflow is usable with accessibility tools.

## Diana's issues in this milestone, in build order

### 1. Setup Internationalization Framework

**Your role:** Language selector UI

**Also touches this issue:** Lada (i18n config/integration)

## Description

Create the translation system used across the application.

## Checklist

- [ ] Install i18n framework
- [ ] Configure language files
- [ ] Create translation structure
- [ ] Add language selector
- [ ] Store user language preference
- [ ] Detect default user language

## Acceptance Criteria

- Application supports multiple languages.
- Users can switch languages.
- Language preference is saved.

---

### 2. Add Application Translations

**Your role:** UI content, coordinates translation text with team

## Description

Translate all user-facing content.

Supported languages:

- English
- Czech
- Spanish

## Checklist

- [ ] Translate navigation
- [ ] Translate authentication pages
- [ ] Translate dashboards
- [ ] Translate evaluation workflow
- [ ] Translate notifications
- [ ] Translate search interface
- [ ] Translate error messages

## Acceptance Criteria

- All important UI text is translated.
- No important user-facing text remains untranslated.

---

### 3. Implement WCAG Accessibility Improvements

**Your role:** UI/UX

## Description

Improve usability for users with accessibility requirements.

## Checklist

- [ ] Add keyboard navigation
- [ ] Add ARIA labels
- [ ] Improve focus management
- [ ] Improve screen reader support
- [ ] Check color contrast
- [ ] Test accessibility

## Acceptance Criteria

- Application can be navigated by keyboard.
- Important elements are accessible.
- WCAG requirements are tested.


---
