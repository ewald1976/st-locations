const MODULE_NAME = "st_locations";

const DEFAULT_SETTINGS = Object.freeze({
  locations: [],
});

const DEFAULT_SCENE = Object.freeze({
  currentLocationId: null,
  sceneStartedAt: null,
  sceneCounter: 0,
  locationSnapshot: null,
  selectedNpcId: null,
});

const CHAT_MODE = Object.freeze({
  DIRECT: "direct",
  GROUP: "group",
  SELECT: "select",
});

const dom = {
  root: null,
  activeScene: null,
  locationList: null,
  sceneContext: null,
  manageButton: null,
};

const popupState = {
  popup: null,
  root: null,
  list: null,
  formId: null,
  formName: null,
  formDescription: null,
  formChatMode: null,
  formPrimaryNpc: null,
  npcList: null,
  saveButton: null,
  cancelButton: null,
  deleteButton: null,
  newButton: null,
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
      extensionSettings[MODULE_NAME][key] = structuredClone(
        DEFAULT_SETTINGS[key],
      );
    }
  }

  if (!Array.isArray(extensionSettings[MODULE_NAME].locations)) {
    extensionSettings[MODULE_NAME].locations = [];
  }

  extensionSettings[MODULE_NAME].locations = extensionSettings[
    MODULE_NAME
  ].locations
    .map(normalizeLocation)
    .filter(Boolean);

  return extensionSettings[MODULE_NAME];
}

function getSceneState() {
  const context = getContext();

  if (!context.chatMetadata[MODULE_NAME]) {
    context.chatMetadata[MODULE_NAME] = structuredClone(DEFAULT_SCENE);
  }

  for (const key of Object.keys(DEFAULT_SCENE)) {
    if (!Object.hasOwn(context.chatMetadata[MODULE_NAME], key)) {
      context.chatMetadata[MODULE_NAME][key] = structuredClone(
        DEFAULT_SCENE[key],
      );
    }
  }

  return context.chatMetadata[MODULE_NAME];
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeLocation(location) {
  if (!location || typeof location !== "object") {
    return null;
  }

  const name = String(location.name || "").trim();
  const description = String(location.description || "").trim();
  const baseId = slugify(location.id || name) || "location";
  const npcs = Array.isArray(location.npcs)
    ? location.npcs.map((npcId) => String(npcId)).filter(Boolean)
    : [];
  const uniqueNpcs = [...new Set(npcs)];
  const defaultChatMode =
    uniqueNpcs.length <= 1 ? CHAT_MODE.DIRECT : CHAT_MODE.SELECT;
  const chatMode = Object.values(CHAT_MODE).includes(location.chat_mode)
    ? location.chat_mode
    : defaultChatMode;
  const primaryNpc =
    typeof location.primary_npc === "string" &&
    uniqueNpcs.includes(location.primary_npc)
      ? location.primary_npc
      : uniqueNpcs[0] || null;

  return {
    id: baseId,
    name,
    description,
    npcs: uniqueNpcs,
    chat_mode: chatMode,
    primary_npc: chatMode === CHAT_MODE.DIRECT ? primaryNpc : null,
  };
}

function getDefaultChatMode(npcIds) {
  return npcIds.length <= 1 ? CHAT_MODE.DIRECT : CHAT_MODE.SELECT;
}

function validateLocation(location) {
  if (!location.name) {
    return "Location name is required.";
  }

  if (!Array.isArray(location.npcs) || !location.npcs.length) {
    return "At least one NPC is required.";
  }

  if (location.chat_mode === CHAT_MODE.DIRECT) {
    if (!location.primary_npc) {
      return "Primary NPC is required for direct mode.";
    }

    if (!location.npcs.includes(location.primary_npc)) {
      return "Primary NPC must be part of the location NPC list.";
    }
  }

  if (location.chat_mode === CHAT_MODE.GROUP && location.npcs.length < 2) {
    return "Group mode requires at least two NPCs.";
  }

  return null;
}

function dedupeId(baseId, ignoreId = null) {
  const { locations } = getSettings();
  let candidate = baseId || "location";
  let index = 2;

  while (
    locations.some(
      (location) => location.id === candidate && location.id !== ignoreId,
    )
  ) {
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
    .filter(
      (item, index, list) =>
        list.findIndex((other) => other.id === item.id) === index,
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function findLocation(locationId) {
  return (
    getSettings().locations.find((location) => location.id === locationId) ||
    null
  );
}

function getCharacterNameById(characterId) {
  return (
    getCharacterOptions().find((character) => character.id === characterId)?.name ||
    null
  );
}

function getLocationNpcOptions(location) {
  return getCharacterOptions().filter((character) =>
    location.npcs.includes(character.id),
  );
}

function getCheckedNpcIds(container) {
  if (!container) {
    return [];
  }

  return Array.from(
    container.querySelectorAll('input[type="checkbox"]:checked'),
  ).map((input) => input.value);
}

function clearPopupRefs() {
  popupState.popup = null;
  popupState.root = null;
  popupState.list = null;
  popupState.formId = null;
  popupState.formName = null;
  popupState.formDescription = null;
  popupState.formChatMode = null;
  popupState.formPrimaryNpc = null;
  popupState.npcList = null;
  popupState.saveButton = null;
  popupState.cancelButton = null;
  popupState.deleteButton = null;
  popupState.newButton = null;
}

function resetPopupForm() {
  if (!popupState.root) {
    return;
  }

  popupState.formId.value = "";
  popupState.formName.value = "";
  popupState.formDescription.value = "";
  popupState.formChatMode.value = CHAT_MODE.DIRECT;
  popupState.formPrimaryNpc.innerHTML = '<option value="">No NPC available</option>';
  popupState.formPrimaryNpc.value = "";

  for (const input of popupState.npcList.querySelectorAll(
    'input[type="checkbox"]',
  )) {
    input.checked = false;
  }

  popupState.deleteButton.disabled = true;
}

function populatePopupForm(locationId) {
  if (!popupState.root) {
    return;
  }

  const location = findLocation(locationId);

  if (!location) {
    resetPopupForm();
    return;
  }

  popupState.formId.value = location.id;
  popupState.formName.value = location.name;
  popupState.formDescription.value = location.description;
  popupState.formChatMode.value = location.chat_mode;

  const selectedIds = new Set(location.npcs);
  for (const input of popupState.npcList.querySelectorAll(
    'input[type="checkbox"]',
  )) {
    input.checked = selectedIds.has(input.value);
  }

  updateInteractionModeUI(location.primary_npc);

  popupState.deleteButton.disabled = false;
}

async function persistSettings() {
  getContext().saveSettingsDebounced();
}

async function persistMetadata() {
  await getContext().saveMetadata();
}

async function saveLocationFromPopup() {
  if (!popupState.root) {
    return;
  }

  const settings = getSettings();
  const existingId = popupState.formId.value || null;
  const name = popupState.formName.value.trim();
  const description = popupState.formDescription.value.trim();
  const npcs = [...new Set(getCheckedNpcIds(popupState.npcList))];
  const chatMode = popupState.formChatMode.value || getDefaultChatMode(npcs);
  const primaryNpc =
    chatMode === CHAT_MODE.DIRECT ? popupState.formPrimaryNpc.value || null : null;

  const createdId = existingId || dedupeId(slugify(name) || "location");
  const location = {
    id: createdId,
    name,
    description,
    npcs,
    chat_mode: chatMode,
    primary_npc: primaryNpc,
  };
  const validationError = validateLocation(location);
  if (validationError) {
    toastr.warning(validationError);
    return;
  }

  const existingIndex = settings.locations.findIndex(
    (item) => item.id === existingId,
  );

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
  populatePopupForm(location.id);
  renderManagePopup();
  toastr.success("Location saved.");
}

async function deleteLocationById(locationId) {
  if (!locationId) {
    return;
  }

  const location = findLocation(locationId);
  if (!location) {
    toastr.error("Location not found.");
    return;
  }

  const confirmed = window.confirm(`Delete location: ${location.name}?`);
  if (!confirmed) {
    return;
  }

  const settings = getSettings();
  settings.locations = settings.locations.filter(
    (entry) => entry.id !== locationId,
  );
  await persistSettings();

  const scene = getSceneState();
  if (scene.currentLocationId === locationId) {
    Object.assign(scene, structuredClone(DEFAULT_SCENE));
    await persistMetadata();
  }

  render();
  if (popupState.root) {
    resetPopupForm();
    renderManagePopup();
  }

  toastr.success("Location deleted.");
}

async function openNpcSelectDialog(location) {
  const context = getContext();
  const npcOptions = getLocationNpcOptions(location);

  if (!npcOptions.length) {
    toastr.warning("No NPCs are available for this location.");
    return null;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "stlp__select-dialog";
  wrapper.innerHTML = `
        <div class="stlp__section-head"><strong>${escapeHtml(location.name)}</strong></div>
        <div class="stlp__meta">Choose who to start this scene with.</div>
        <label class="stlp__label" for="stlp-select-scene-npc">NPC</label>
        <select id="stlp-select-scene-npc" class="text_pole stlp__select-input">
            ${npcOptions
              .map(
                (npc, index) => `
                    <option value="${escapeHtml(npc.id)}" ${index === 0 ? "selected" : ""}>${escapeHtml(npc.name)}</option>
                `,
              )
              .join("")}
        </select>
    `;

  const select = wrapper.querySelector("#stlp-select-scene-npc");
  const popup = new context.Popup(wrapper, context.POPUP_TYPE.CONFIRM, null, {
    okButton: "Start Scene",
    cancelButton: "Cancel",
  });
  const result = await popup.show();

  if (result !== context.POPUP_RESULT.AFFIRMATIVE) {
    return null;
  }

  return select.value || null;
}

async function switchLocation(locationId) {
  const location = findLocation(locationId);
  if (!location) {
    toastr.error("Location not found.");
    return;
  }

  let selectedNpcId = null;
  if (location.chat_mode === CHAT_MODE.DIRECT) {
    selectedNpcId = location.primary_npc;
  }

  if (location.chat_mode === CHAT_MODE.SELECT) {
    selectedNpcId = await openNpcSelectDialog(location);
    if (!selectedNpcId) {
      return;
    }
  }

  const scene = getSceneState();
  scene.currentLocationId = location.id;
  scene.sceneStartedAt = new Date().toISOString();
  scene.sceneCounter = Number(scene.sceneCounter || 0) + 1;
  scene.locationSnapshot = structuredClone(location);
  scene.selectedNpcId = selectedNpcId;

  await persistMetadata();
  render();
  if (popupState.root) {
    renderManagePopup();
  }

  toastr.success(`Scene started: ${location.name}`);
}

function renderActiveScene() {
  const scene = getSceneState();
  const location =
    scene.locationSnapshot || findLocation(scene.currentLocationId);

  if (!location) {
    dom.activeScene.classList.add("is-empty");
    dom.activeScene.innerHTML = "<div>No active location in this chat.</div>";
    dom.sceneContext.value = "";
    return;
  }

  const npcNames = getCharacterOptions()
    .filter((option) => location.npcs.includes(option.id))
    .map((option) => option.name);
  const sceneContext = location.description || "No description set.";
  const modeLabel =
    location.chat_mode === CHAT_MODE.DIRECT
      ? "Direct"
      : location.chat_mode === CHAT_MODE.GROUP
        ? "Group"
        : "Select";
  const primaryNpcName =
    getCharacterOptions().find((option) => option.id === location.primary_npc)
      ?.name || "None";
  const selectedNpcName = getCharacterNameById(scene.selectedNpcId) || "None";

  dom.activeScene.classList.remove("is-empty");
  dom.activeScene.innerHTML = `
        <div><span class="stlp__badge">Active</span> <strong>${escapeHtml(location.name)}</strong></div>
        <div>${escapeHtml(sceneContext)}</div>
        <div class="stlp__meta">NPCs: ${escapeHtml(npcNames.join(", ") || "None")}</div>
        <div class="stlp__meta">Interaction: ${escapeHtml(modeLabel)}</div>
        ${location.chat_mode === CHAT_MODE.DIRECT ? `<div class="stlp__meta">Primary NPC: ${escapeHtml(primaryNpcName)}</div>` : ""}
        ${location.chat_mode === CHAT_MODE.SELECT ? `<div class="stlp__meta">Selected NPC: ${escapeHtml(selectedNpcName)}</div>` : ""}
        <div class="stlp__meta">Scene #: ${escapeHtml(scene.sceneCounter || 0)}</div>
        <div class="stlp__meta">Scene started: ${escapeHtml(scene.sceneStartedAt || "Not started yet")}</div>
    `;
  dom.sceneContext.value = sceneContext;
}

function renderLocationList() {
  const settings = getSettings();
  const activeId = getSceneState().currentLocationId;
  const characters = getCharacterOptions();

  if (!settings.locations.length) {
    dom.locationList.innerHTML =
      '<div class="stlp__empty">No locations created yet.</div>';
    return;
  }

  dom.locationList.innerHTML = settings.locations
    .map((location) => {
      const npcNames = characters
        .filter((character) => location.npcs.includes(character.id))
        .map((character) => character.name);
      const modeLabel =
        location.chat_mode === CHAT_MODE.DIRECT
          ? "Direct"
          : location.chat_mode === CHAT_MODE.GROUP
            ? "Group"
            : "Select";

      return `
                <div class="stlp__location-card">
                    <div class="stlp__location-top">
                        <div>
                            <div class="stlp__location-name">${escapeHtml(location.name)}</div>
                            <div class="stlp__location-id">${escapeHtml(location.id)}</div>
                        </div>
                        ${activeId === location.id ? '<span class="stlp__badge">Active Scene</span>' : ""}
                    </div>
                    <div class="stlp__location-description">${escapeHtml(location.description || "No description set.")}</div>
                    <div class="stlp__meta">NPCs: ${escapeHtml(npcNames.join(", ") || "None")}</div>
                    <div class="stlp__meta">Interaction: ${escapeHtml(modeLabel)}</div>
                    <div class="stlp__location-actions">
                        <button type="button" class="menu_button stlp-edit-location" data-location-id="${escapeHtml(location.id)}">Edit</button>
                        <button type="button" class="menu_button stlp-switch-location" data-location-id="${escapeHtml(location.id)}">Start Scene</button>
                    </div>
                </div>
            `;
    })
    .join("");
}

function bindDynamicActions() {
  for (const button of dom.locationList.querySelectorAll(
    ".stlp-edit-location",
  )) {
    button.addEventListener("click", () =>
      openManageLocationsPopup(button.dataset.locationId),
    );
  }

  for (const button of dom.locationList.querySelectorAll(
    ".stlp-switch-location",
  )) {
    button.addEventListener("click", () =>
      switchLocation(button.dataset.locationId),
    );
  }
}

function render() {
  renderActiveScene();
  renderLocationList();
  bindDynamicActions();
}

function renderPopupNpcOptions(selectedIds = []) {
  const options = getCharacterOptions();
  const selected = new Set(selectedIds);

  if (!options.length) {
    popupState.npcList.innerHTML =
      '<div class="stlp__empty">No character cards found.</div>';
    return;
  }

  popupState.npcList.innerHTML = options
    .map(
      (option) => `
            <label class="stlp__npc-item">
                <input type="checkbox" value="${escapeHtml(option.id)}" ${selected.has(option.id) ? "checked" : ""} />
                <span>${escapeHtml(option.name)}</span>
            </label>
        `,
    )
    .join("");
}

function renderPrimaryNpcOptions(selectedNpcIds, preferredNpcId = "") {
  const characters = getCharacterOptions().filter((character) =>
    selectedNpcIds.includes(character.id),
  );

  const preferred =
    characters.find((character) => character.id === preferredNpcId)?.id ||
    characters[0]?.id ||
    "";

  popupState.formPrimaryNpc.innerHTML = characters.length
    ? characters
        .map(
          (character) => `
                <option value="${escapeHtml(character.id)}" ${character.id === preferred ? "selected" : ""}>${escapeHtml(character.name)}</option>
            `,
        )
        .join("")
    : '<option value="">No NPC available</option>';

  popupState.formPrimaryNpc.value = preferred;
}

function updateInteractionModeUI(preferredNpcId = "") {
  if (!popupState.root) {
    return;
  }

  const selectedNpcIds = getCheckedNpcIds(popupState.npcList);
  const chatMode = popupState.formChatMode.value;

  renderPrimaryNpcOptions(
    selectedNpcIds,
    preferredNpcId || popupState.formPrimaryNpc.value,
  );

  const primaryNpcRow = popupState.root.querySelector(".stlp-primary-npc-row");
  primaryNpcRow.hidden = chatMode !== CHAT_MODE.DIRECT;

  if (chatMode !== CHAT_MODE.DIRECT) {
    popupState.formPrimaryNpc.value = "";
  }
}

function renderManagePopup() {
  if (!popupState.root) {
    return;
  }

  const settings = getSettings();
  const activeId = getSceneState().currentLocationId;
  const characters = getCharacterOptions();
  const editingId = popupState.formId?.value || "";

  if (!settings.locations.length) {
    popupState.list.innerHTML =
      '<div class="stlp__empty">No locations created yet.</div>';
  } else {
    popupState.list.innerHTML = settings.locations
      .map((location) => {
        const npcNames = characters
          .filter((character) => location.npcs.includes(character.id))
          .map((character) => character.name);
        const modeLabel =
          location.chat_mode === CHAT_MODE.DIRECT
            ? "Direct"
            : location.chat_mode === CHAT_MODE.GROUP
              ? "Group"
              : "Select";

        return `
                <div class="stlp__popup-location ${editingId === location.id ? "is-selected" : ""}">
                    <div class="stlp__popup-location-row">
                        <div>
                            <div class="stlp__location-name">${escapeHtml(location.name)}</div>
                            <div class="stlp__meta">NPCs: ${escapeHtml(npcNames.join(", ") || "None")}</div>
                            <div class="stlp__meta">Interaction: ${escapeHtml(modeLabel)}</div>
                        </div>
                        ${activeId === location.id ? '<span class="stlp__badge">Active</span>' : ""}
                    </div>
                    <div class="stlp__location-actions">
                        <button type="button" class="menu_button stlp-popup-edit" data-location-id="${escapeHtml(location.id)}">Edit</button>
                        <button type="button" class="menu_button menu_button_danger stlp-popup-delete" data-location-id="${escapeHtml(location.id)}">Remove</button>
                    </div>
                </div>
            `;
      })
      .join("");
  }

  const selectedIds =
    editingId && findLocation(editingId)
      ? findLocation(editingId).npcs
      : getCheckedNpcIds(popupState.npcList);
  renderPopupNpcOptions(selectedIds);
  updateInteractionModeUI(editingId ? findLocation(editingId)?.primary_npc : "");
  bindPopupActions();
}

function bindPopupActions() {
  if (!popupState.root) {
    return;
  }

  popupState.newButton.onclick = () => {
    resetPopupForm();
    updateInteractionModeUI();
    renderManagePopup();
  };
  popupState.cancelButton.onclick = () => {
    resetPopupForm();
    updateInteractionModeUI();
    renderManagePopup();
  };
  popupState.saveButton.onclick = () => void saveLocationFromPopup();
  popupState.deleteButton.onclick = () =>
    void deleteLocationById(popupState.formId.value);

  for (const button of popupState.list.querySelectorAll(".stlp-popup-edit")) {
    button.onclick = () => {
      populatePopupForm(button.dataset.locationId);
      renderManagePopup();
    };
  }

  for (const button of popupState.list.querySelectorAll(".stlp-popup-delete")) {
    button.onclick = () => void deleteLocationById(button.dataset.locationId);
  }

  popupState.formChatMode.onchange = () => updateInteractionModeUI();
  popupState.formPrimaryNpc.onchange = () => updateInteractionModeUI();

  for (const input of popupState.npcList.querySelectorAll('input[type="checkbox"]')) {
    input.onchange = () => {
      const selectedNpcIds = getCheckedNpcIds(popupState.npcList);
      const fallbackMode = getDefaultChatMode(selectedNpcIds);

      if (!popupState.formId.value && popupState.formChatMode.value !== CHAT_MODE.GROUP) {
        popupState.formChatMode.value = fallbackMode;
      }

      updateInteractionModeUI();
    };
  }
}

function buildManagePopupContent() {
  const wrapper = document.createElement("div");
  wrapper.className = "stlp__popup";
  wrapper.innerHTML = `
        <div class="stlp__popup-grid">
            <div class="stlp__popup-column">
                <div class="stlp__section-head"><strong>Locations</strong></div>
                <div class="stlp__popup-list"></div>
                <button type="button" class="menu_button stlp-new-location">New Location</button>
            </div>
            <div class="stlp__popup-column">
                <div class="stlp__section-head"><strong>Location Editor</strong></div>
                <input type="hidden" class="stlp-popup-location-id" />
                <label class="stlp__label" for="stlp-popup-location-name">Location Name</label>
                <input id="stlp-popup-location-name" class="text_pole stlp-popup-location-name" type="text" placeholder="Tavern" />
                <label class="stlp__label" for="stlp-popup-location-description">Description</label>
                <textarea
                    id="stlp-popup-location-description"
                    class="text_pole stlp-popup-location-description"
                    rows="4"
                    placeholder="A warm, noisy tavern filled with conversation and the smell of beer."
                ></textarea>
                <label class="stlp__label" for="stlp-popup-chat-mode">Interaction Mode</label>
                <select id="stlp-popup-chat-mode" class="text_pole stlp-popup-chat-mode">
                    <option value="direct">Direct</option>
                    <option value="group">Group</option>
                    <option value="select">Select</option>
                </select>
                <div class="stlp-primary-npc-row">
                    <label class="stlp__label" for="stlp-popup-primary-npc">Primary NPC</label>
                    <select id="stlp-popup-primary-npc" class="text_pole stlp-popup-primary-npc"></select>
                </div>
                <div class="stlp__label">Select NPCs</div>
                <div class="stlp__npc-list stlp-popup-npcs"></div>
                <div class="stlp__actions">
                    <button type="button" class="menu_button stlp-popup-save">Save</button>
                    <button type="button" class="menu_button menu_button_secondary stlp-popup-cancel">Cancel</button>
                    <button type="button" class="menu_button menu_button_danger stlp-popup-delete-current">Delete</button>
                </div>
            </div>
        </div>
    `;

  popupState.root = wrapper;
  popupState.list = wrapper.querySelector(".stlp__popup-list");
  popupState.formId = wrapper.querySelector(".stlp-popup-location-id");
  popupState.formName = wrapper.querySelector(".stlp-popup-location-name");
  popupState.formDescription = wrapper.querySelector(
    ".stlp-popup-location-description",
  );
  popupState.formChatMode = wrapper.querySelector(".stlp-popup-chat-mode");
  popupState.formPrimaryNpc = wrapper.querySelector(".stlp-popup-primary-npc");
  popupState.npcList = wrapper.querySelector(".stlp-popup-npcs");
  popupState.saveButton = wrapper.querySelector(".stlp-popup-save");
  popupState.cancelButton = wrapper.querySelector(".stlp-popup-cancel");
  popupState.deleteButton = wrapper.querySelector(".stlp-popup-delete-current");
  popupState.newButton = wrapper.querySelector(".stlp-new-location");

  resetPopupForm();
  renderManagePopup();

  return wrapper;
}

async function openManageLocationsPopup(locationId = null) {
  if (popupState.popup) {
    if (locationId) {
      populatePopupForm(locationId);
      renderManagePopup();
    }
    return;
  }

  const context = getContext();
  const content = buildManagePopupContent();
  const popup = new context.Popup(content, context.POPUP_TYPE.DISPLAY, null, {
    wide: true,
    large: true,
    allowVerticalScrolling: true,
    onClose: () => clearPopupRefs(),
  });

  popupState.popup = popup;

  if (locationId) {
    populatePopupForm(locationId);
    renderManagePopup();
  }

  await popup.show();
}

async function mountSettings() {
  if (document.getElementById("st-location-plugin")) {
    return true;
  }

  const settingsHost = document.getElementById("extensions_settings2");
  if (!settingsHost) {
    return false;
  }

  const html = await getContext().renderExtensionTemplateAsync(
    "third-party/st-locations",
    "settings",
  );
  settingsHost.insertAdjacentHTML("beforeend", html);

  dom.root = document.getElementById("st-location-plugin");
  dom.activeScene = document.getElementById("stlp-active-scene");
  dom.locationList = document.getElementById("stlp-location-list");
  dom.sceneContext = document.getElementById("stlp-scene-context");
  dom.manageButton = document.getElementById("stlp-manage-locations");

  dom.manageButton.addEventListener("click", () => void openManageLocationsPopup());

  render();
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

window.addEventListener("focus", () => {
  if (dom.root) {
    render();
    if (popupState.root) {
      renderManagePopup();
    }
  }
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && dom.root) {
    render();
    if (popupState.root) {
      renderManagePopup();
    }
  }
});
