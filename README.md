# ST Location Plugin

Ein minimales SillyTavern-Extension-v0 fuer statische Locations als Szenenanker.

## v0 Umfang

Dieses Plugin macht nur:

- Locations anzeigen
- Locations erstellen, bearbeiten und loeschen
- NPCs pro Location zuweisen
- aktive Location pro Chat als Szenen-Metadaten setzen

Bewusst nicht Teil von v0:

- keine automatische Prompt-Logik
- kein Lore-Management
- kein Memory-System
- keine Events, Quests oder Story-Engine
- keine dynamischen Locations
- keine RPG-Mechaniken

## Datenmodell

Jede Location speichert:

- `id`
- `name`
- `description`
- `npcs`

Die aktive Szene wird chat-spezifisch in den Chat-Metadaten gehalten:

- `currentLocationId`
- `sceneStartedAt`
- `sceneCounter`
- `locationSnapshot`

## Installation

1. Diesen Ordner nach `SillyTavern/data/default-user/extensions/third-party/ST-Location` kopieren.
2. SillyTavern neu laden.
3. Im Extensions-Bereich den Drawer `Location Plugin` oeffnen.

## Nutzung

1. Name und Description eintragen.
2. NPCs aus vorhandenen Character Cards auswaehlen.
3. `Save` klicken.
4. In der Liste `Start Scene` klicken, um die aktive Location fuer den aktuellen Chat zu setzen.

## Hinweis zu v0

Das Plugin setzt bewusst nur strukturierte Szenen-Metadaten. Es injiziert keine Prompts und veraendert keine Gruppen- oder Chatlogik automatisch.
