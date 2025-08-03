# Requirements Document

## Introduction

This feature restructures the OrbisJS editor interface by eliminating the previous customization system and implementing a modern split view layout similar to Vite's interface. The new design features an editor on the left side and results/render output on the right side, complemented by a minimalist floating toolbar that can be toggled and customized by users based on context.

## Requirements

### Requirement 1

**User Story:** As a developer, I want a split view layout with the editor on the left and results on the right, so that I can see my code and its output simultaneously without switching between tabs or panels.

#### Acceptance Criteria

1. WHEN the application loads THEN the interface SHALL display a split view with the editor occupying the left panel and results/render output occupying the right panel
2. WHEN I resize the split view THEN the system SHALL maintain proportional sizing and remember the user's preferred split ratio
3. WHEN I write code in the left editor THEN the right panel SHALL automatically update with the execution results or rendered output
4. IF the right panel content overflows THEN the system SHALL provide appropriate scrolling mechanisms

### Requirement 2

**User Story:** As a developer, I want a minimalist floating toolbar linked to the editor, so that I can access essential tools without cluttering the interface.

#### Acceptance Criteria

1. WHEN the editor is active THEN the system SHALL display a floating toolbar positioned near the editor area
2. WHEN I interact with the floating toolbar THEN it SHALL provide quick access to common editor actions and tools
3. WHEN the toolbar is not in use THEN it SHALL remain unobtrusive and not interfere with the coding experience
4. IF I hover over or focus on the editor area THEN the floating toolbar SHALL become more visible or prominent

### Requirement 3

**User Story:** As a developer, I want to toggle the floating toolbar on/off, so that I can customize my workspace based on my current needs and preferences.

#### Acceptance Criteria

1. WHEN I use a keyboard shortcut or menu option THEN the system SHALL hide or show the floating toolbar
2. WHEN the toolbar is hidden THEN the system SHALL remember this preference for future sessions
3. WHEN the toolbar is toggled off THEN all editor functionality SHALL remain accessible through alternative means (keyboard shortcuts, context menus)
4. IF I need to access toolbar functions while it's hidden THEN the system SHALL provide a way to temporarily show it

### Requirement 4

**User Story:** As a developer, I want to create custom toolbars based on context, so that I can have different tool sets available for different types of work (JavaScript, TypeScript, CSS, etc.).

#### Acceptance Criteria

1. WHEN I'm working with different file types THEN the system SHALL allow me to configure context-specific toolbar layouts
2. WHEN I switch between file types or contexts THEN the floating toolbar SHALL automatically adapt to show relevant tools
3. WHEN I customize a toolbar for a specific context THEN the system SHALL save these customizations for future use
4. IF I want to reset toolbar customizations THEN the system SHALL provide an option to restore default configurations

### Requirement 5

**User Story:** As a developer, I want the new interface to follow modern, clean, and discrete design principles, so that the interface feels contemporary and doesn't distract from my coding work.

#### Acceptance Criteria

1. WHEN I use the application THEN the interface SHALL follow modern design principles with clean lines and minimal visual clutter
2. WHEN elements are not actively in use THEN they SHALL have subtle, discrete styling that doesn't draw unnecessary attention
3. WHEN I interact with interface elements THEN they SHALL provide appropriate visual feedback without being overly prominent
4. IF the interface needs to show status or information THEN it SHALL do so in a way that's informative but not distracting

### Requirement 6

**User Story:** As a developer, I want the removal of the previous customization system to be seamless, so that the transition to the new interface doesn't break my existing workflow.

#### Acceptance Criteria

1. WHEN the new interface is implemented THEN the system SHALL cleanly remove all components from the previous customization system
2. WHEN I upgrade to the new interface THEN any existing user preferences SHALL be migrated or reset gracefully
3. WHEN the old system is removed THEN no orphaned code or unused dependencies SHALL remain in the codebase
4. IF there are breaking changes THEN the system SHALL provide clear communication about what has changed