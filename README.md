# ST Location Plugin

A minimal SillyTavern extension v0 for static locations as scene anchors.

## v0 Scope

This plugin only does:

- show locations
- create, edit, and delete locations
- assign NPCs per location
- set the active location as chat-specific scene metadata
- show the active location context in the UI

Deliberately not part of v0:

- no automatic prompt logic
- no lore management
- no memory system
- no events, quests, or story engine
- no dynamic locations
- no RPG mechanics

## Data Model

Each location stores:

- `id`
- `name`
- `description`
- `npcs`
- `chat_mode`
- `primary_npc`

The active scene is stored per chat in chat metadata:

- `currentLocationId`
- `sceneStartedAt`
- `sceneCounter`
- `locationSnapshot`

## Installation

1. Copy this folder to `SillyTavern/data/default-user/extensions/third-party/st-locations`.
2. Reload SillyTavern.
3. Open the `Location Plugin` drawer in the Extensions panel.

## Usage

1. Click `Manage Locations`.
2. Create or edit a location in the popup.
3. Select NPCs, set the interaction mode, and choose a primary NPC when using `Direct`.
4. Click `Start Scene` in the drawer to set the active location for the current chat.
5. The active description appears above as readable scene context.

## Interaction Modes

- `Direct`: opens the scene through one primary NPC
- `Group`: intended for group chat entry with all NPCs
- `Select`: intended for choosing an NPC when entering the scene

Defaults:

- `1 NPC -> Direct`
- `2+ NPCs -> Select`

Validation:

- `Direct` requires `primary_npc`, and it must be part of `npcs`
- `Group` requires at least 2 NPCs
- `Select` requires at least 1 NPC

## v0.2 Note

This plugin now stores scene entry metadata in addition to scene context. It still does not inject prompts and does not yet create or manage SillyTavern chats automatically.
