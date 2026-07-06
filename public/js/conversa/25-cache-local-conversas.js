function restoreChatsFromCache() {
    const cachedChats = readJsonCache(getChatsCacheKey(), CHAT_CACHE_TTL_MS);

    if (!cachedChats || cachedChats.length === 0 || (state.allChats || []).length) {
      return false;
    }

    state.allChats = cachedChats;
    updateArchivedToggleButton();
    renderChats();

    return true;
  }

function saveChatsToCache(chats) {
    if (!Array.isArray(chats)) return;

    writeJsonCache(getChatsCacheKey(), chats.slice(0, 250));
  }

function restoreUsersFromCache() {
    const cachedUsers = readJsonCache(getUserScopedKey("users"), USERS_CACHE_TTL_MS);

    if (!cachedUsers || cachedUsers.length === 0) {
      return false;
    }

    state.allUsers = cachedUsers;
    renderUsersForPrivateChat();
    renderUsersForGroup();

    return true;
  }

function saveUsersToCache(users) {
    if (!Array.isArray(users)) return;

    writeJsonCache(getUserScopedKey("users"), users.slice(0, 500));
  }

function appendNodesInChunks(target, nodes, options = {}) {
    const chunkSize = Number(options.chunkSize || 24);

    let index = 0;

    function renderChunk() {
      const fragment = document.createDocumentFragment();
      const end = Math.min(index + chunkSize, nodes.length);

      while (index < end) {
        fragment.appendChild(nodes[index]);
        index += 1;
      }

      target.appendChild(fragment);

      if (index < nodes.length) {
        window.requestAnimationFrame(renderChunk);
      }
    }

    renderChunk();
  }

async function loadUsers(options = {}) {
    if (options.useCache !== false) {
      restoreUsersFromCache();
    }

    const data = await api.request("/api/users");
    state.allUsers = data.data || [];

    saveUsersToCache(state.allUsers);
    renderUsersForPrivateChat();
    renderUsersForGroup();

    return state.allUsers;
  }
