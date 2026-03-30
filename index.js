const MODULE_NAME = 'st_location_plugin';

const DEFAULT_SETTINGS = Object.freeze({
    locations: [],
});

const DEFAULT_SCENE = Object.freeze({
    currentLocationId: null,
    sceneStartedAt: null,
    sceneCounter: 0,
    locationSnapshot: null,
});

const dom = {
    root: null,
    activeScene: null,
    locationList: null,
    npcList: null,
    formId: null,
    formName: null,
    formDescription: null,
    saveButton: null,
    resetButton: null,
    deleteButton: null,
};

function getContext() {
    return SillyTavern.getContext();
}

function getSettings() {
    const { extensionSettings } = getContext();

    if (!extensionSettings[MODULE_NAME]) {
        extensionSettings[MODULE_NAME] = structuredClone(DEFAULT_SETTINGS);
    }

    for (const key of Object.keys(DEFAULT_SETTINGS)) {
        if (!Object.hasOwn(extensionSettings[MODULE_NAME], key)) {
            extensionSettings[MODULE_NAME][key] = structuredClone(DEFAULT_SETTINGS[key]);
        }
    }

    if (!Array.isArray(extensionSettings[MODULE_NAME].locations)) {
        extensionSettings[MODULE_NAME].locations = [];
    }

    return extensionSettings[MODULE_NAME];
}

function getSceneState() {
    const context = getContext();

    if (!context.chatMetadata[MODULE_NAME]) {
        context.chatMetadata[MODULE_NAME] = structuredClone(DEFAULT_SCENE);
    }

    for (const key of Object.keys(DEFAULT_SCENE)) {
        if (!Object.hasOwn(context.chatMetadata[MODULE_NAME], key)) {
            context.chatMetadata[MODULE_NAME][key] = structuredClone(DEFAULT_SCENE[key]);
        }
    }

    return context.chatMetadata[MODULE_NAME];
}

function slugify(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function dedupeId(baseId, ignoreId = null) {
    const { locations } = getSettings();
    let candidate = baseId || 'location';
    let index = 2;

    while (locations.some((location) => location.id === candidate && location.id !== ignoreId)) {
        candidate = `${baseId}-${index}`;
        index += 1;
    }

    return candidate;
}

function getCharacterOptions() {
    const { characters } = getContext();

    return (Array.isArray(characters) ? characters : [])
        .map((character, index) => {
            const id = String(character.avatar || character.name || index);
            const name = character.name || `Character ${index + 1}`;
            return { id, name };
        })
        .filter((item, index, list) => list.findIndex((other) => other.id === item.id) === index)
        .sort((a, b) => a.name.localeCompare(b.name));
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function findLocation(locationId) {
    return getSettings().locations.find((location) => location.id === locationId) || null;
}

function getSelectedNpcIds() {
    return Array.from(dom.npcList.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value);
}

function resetForm() {
    dom.formId.value = '';
    dom.formName.value = '';
    dom.formDescription.value = '';

    for (const input of dom.npcList.querySelectorAll('input[type="checkbox"]')) {
        input.checked = false;
    }

    dom.deleteButton.disabled = true;
}

function populateForm(locationId) {
    const location = findLocation(locationId);

    if (!location) {
        resetForm();
        return;
    }

    dom.formId.value = location.id;
    dom.formName.value = location.name;
    dom.formDescription.value = location.description;

    const selectedIds = new Set(location.npcs);
    for (const input of dom.npcList.querySelectorAll('input[type="checkbox"]')) {
        input.checked = selectedIds.has(input.value);
    }

    dom.deleteButton.disabled = false;
}

async function persistSettings() {
    getContext().saveSettingsDebounced();
}

async function persistMetadata() {
    await getContext().saveMetadata();
}

async function saveLocation() {
    const settings = getSettings();
    const existingId = dom.formId.value || null;
    const name = dom.formName.value.trim();
    const description = dom.formDescription.value.trim();

    if (!name) {
        toastr.warning('Location Name ist erforderlich.');
        return;
    }

    const baseId = slugify(name) || 'location';
    const id = existingId || dedupeId(baseId);
    const resolvedId = existingId ? dedupeId(baseId, existingId) : id;

    const location = {
        id: resolvedId,
        name,
        description,
        npcs: getSelectedNpcIds(),
    };

    const existingIndex = settings.locations.findIndex((item) => item.id === existingId);
    if (existingIndex >= 0) {
        settings.locations[existingIndex] = location;
    } else {
        settings.locations.push(location);
    }

    settings.locations.sort((a, b) => a.name.localeCompare(b.name));

    const scene = getSceneState();
    if (scene.currentLocationId === existingId) {
        scene.currentLocationId = location.id;
        scene.locationSnapshot = structuredClone(location);
        await persistMetadata();
    }

    await persistSettings();
    render();
    populateForm(location.id);
    toastr.success('Location gespeichert.');
}

async function deleteLocation() {
    const locationId = dom.formId.value;
    if (!locationId) {
        return;
    }

    const settings = getSettings();
    settings.locations = settings.locations.filter((location) => location.id !== locationId);
    await persistSettings();

    const scene = getSceneState();
    if (scene.currentLocationId === locationId) {
        Object.assign(scene, structuredClone(DEFAULT_SCENE));
        await persistMetadata();
    }

    resetForm();
    render();
    toastr.success('Location gelöscht.');
}

async function switchLocation(locationId) {
    const location = findLocation(locationId);
    if (!location) {
        toastr.error('Location nicht gefunden.');
        return;
    }

    const scene = getSceneState();
    scene.currentLocationId = location.id;
    scene.sceneStartedAt = new Date().toISOString();
    scene.sceneCounter = Number(scene.sceneCounter || 0) + 1;
    scene.locationSnapshot = structuredClone(location);

    await persistMetadata();
    render();
    toastr.success(`Szene gestartet: ${location.name}`);
}

function renderNpcOptions() {
    const options = getCharacterOptions();

    if (!options.length) {
        dom.npcList.innerHTML = '<div class="stlp__empty">Keine Character Cards gefunden.</div>';
        return;
    }

    const selectedIds = new Set(getSelectedNpcIds());
    dom.npcList.innerHTML = options
        .map((option) => `
            <label class="stlp__npc-item">
                <input type="checkbox" value="${escapeHtml(option.id)}" ${selectedIds.has(option.id) ? 'checked' : ''} />
                <span>${escapeHtml(option.name)}</span>
            </label>
        `)
        .join('');
}

function renderActiveScene() {
    const scene = getSceneState();
    const location = scene.locationSnapshot || findLocation(scene.currentLocationId);

    if (!location) {
        dom.activeScene.classList.add('is-empty');
        dom.activeScene.innerHTML = '<div>Keine aktive Location in diesem Chat.</div>';
        return;
    }

    const npcNames = getCharacterOptions()
        .filter((option) => location.npcs.includes(option.id))
        .map((option) => option.name);

    dom.activeScene.classList.remove('is-empty');
    dom.activeScene.innerHTML = `
        <div><span class="stlp__badge">Aktiv</span> <strong>${escapeHtml(location.name)}</strong></div>
        <div>${escapeHtml(location.description || 'Keine Description gesetzt.')}</div>
        <div class="stlp__meta">NPCs: ${escapeHtml(npcNames.join(', ') || 'Keine')}</div>
        <div class="stlp__meta">Szenenstart: ${escapeHtml(scene.sceneStartedAt || 'Noch nicht gestartet')}</div>
    `;
}

function renderLocationList() {
    const settings = getSettings();
    const activeId = getSceneState().currentLocationId;
    const characters = getCharacterOptions();

    if (!settings.locations.length) {
        dom.locationList.innerHTML = '<div class="stlp__empty">Noch keine Locations angelegt.</div>';
        return;
    }

    dom.locationList.innerHTML = settings.locations
        .map((location) => {
            const npcNames = characters
                .filter((character) => location.npcs.includes(character.id))
                .map((character) => character.name);

            return `
                <div class="stlp__location-card">
                    <div class="stlp__location-top">
                        <div>
                            <div class="stlp__location-name">${escapeHtml(location.name)}</div>
                            <div class="stlp__location-id">${escapeHtml(location.id)}</div>
                        </div>
                        ${activeId === location.id ? '<span class="stlp__badge">Aktive Szene</span>' : ''}
                    </div>
                    <div class="stlp__location-description">${escapeHtml(location.description || 'Keine Description gesetzt.')}</div>
                    <div class="stlp__meta">NPCs: ${escapeHtml(npcNames.join(', ') || 'Keine')}</div>
                    <div class="stlp__location-actions">
                        <button class="menu_button stlp-edit-location" data-location-id="${escapeHtml(location.id)}">Edit</button>
                        <button class="menu_button stlp-switch-location" data-location-id="${escapeHtml(location.id)}">Start Scene</button>
                    </div>
                </div>
            `;
        })
        .join('');
}

function bindDynamicActions() {
    for (const button of dom.locationList.querySelectorAll('.stlp-edit-location')) {
        button.addEventListener('click', () => populateForm(button.dataset.locationId));
    }

    for (const button of dom.locationList.querySelectorAll('.stlp-switch-location')) {
        button.addEventListener('click', () => switchLocation(button.dataset.locationId));
    }
}

function render() {
    renderNpcOptions();
    renderActiveScene();
    renderLocationList();
    bindDynamicActions();
}

async function mountSettings() {
    if (document.getElementById('st-location-plugin')) {
        return true;
    }

    const settingsHost = document.getElementById('extensions_settings2');
    if (!settingsHost) {
        return false;
    }

    const html = await getContext().renderExtensionTemplateAsync('third-party/ST-Location', 'settings');
    settingsHost.insertAdjacentHTML('beforeend', html);

    dom.root = document.getElementById('st-location-plugin');
    dom.activeScene = document.getElementById('stlp-active-scene');
    dom.locationList = document.getElementById('stlp-location-list');
    dom.npcList = document.getElementById('stlp-npc-list');
    dom.formId = document.getElementById('stlp-location-id');
    dom.formName = document.getElementById('stlp-location-name');
    dom.formDescription = document.getElementById('stlp-location-description');
    dom.saveButton = document.getElementById('stlp-save-location');
    dom.resetButton = document.getElementById('stlp-reset-form');
    dom.deleteButton = document.getElementById('stlp-delete-location');

    dom.saveButton.addEventListener('click', saveLocation);
    dom.resetButton.addEventListener('click', resetForm);
    dom.deleteButton.addEventListener('click', deleteLocation);

    render();
    resetForm();
    return true;
}

async function waitForSettingsHost() {
    if (await mountSettings()) {
        return;
    }

    const observer = new MutationObserver(async () => {
        if (await mountSettings()) {
            observer.disconnect();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

waitForSettingsHost();

window.addEventListener('focus', () => {
    if (dom.root) {
        render();
    }
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden && dom.root) {
        render();
    }
});
