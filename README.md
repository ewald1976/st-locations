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
3. Select NPCs from existing character cards and click `Save`.
4. Click `Start Scene` in the drawer to set the active location for the current chat.
5. The active description appears above as readable scene context.

## v0 Note

This plugin only stores structured scene metadata and shows the active context. It does not inject prompts and does not automatically modify group or chat logic.
