function createStatusRow(group, isMine) {
    const lastStatus = group.statuses[group.statuses.length - 1];

    const button = document.createElement("button");
    button.type = "button";
    button.className = "status-row";

    const avatar = document.createElement("div");
    avatar.className = "status-row-avatar";
    fillAvatar(avatar, group.user, !group.hasUnseen);

    const body = document.createElement("div");
    body.className = "status-row-body";

    const name = document.createElement("strong");
    name.textContent = isMine ? "Meu status" : group.user?.nome || "Contato";

    const subtitle = document.createElement("span");
    subtitle.textContent = lastStatus
      ? `${formatTime(lastStatus.createdAt)} • ${getStatusPreview(lastStatus)}`
      : "Sem atualizações";

    body.appendChild(name);
    body.appendChild(subtitle);

    const count = document.createElement("span");
    count.className = "status-row-count";
    count.textContent = `${group.statuses.length}`;

    button.appendChild(avatar);
    button.appendChild(body);
    button.appendChild(count);

    button.addEventListener("click", () => {
      openStatusViewer(group.user.id);
    });

    return button;
  }

function renderStatusPanel() {
    const myList = safeEl("myStatusList");
    const recentList = safeEl("recentStatusList");

    if (!myList || !recentList) return;

    myList.replaceChildren();
    recentList.replaceChildren();

    const myGroup = getMyGroup();

    if (myGroup) {
      myList.appendChild(createStatusRow(myGroup, true));
    } else {
      const empty = document.createElement("div");
      empty.className = "status-list-empty";
      empty.textContent = "Você ainda não publicou nenhum status.";
      myList.appendChild(empty);
    }

    const otherGroups = getOtherGroups();

    if (!otherGroups.length) {
      const empty = document.createElement("div");
      empty.className = "status-list-empty";
      empty.textContent = "Nenhum status recente dos seus contatos.";
      recentList.appendChild(empty);
      return;
    }

    for (const group of otherGroups) {
      recentList.appendChild(createStatusRow(group, false));
    }
  }

async function loadStatuses(options = {}) {
    const now = Date.now();

    if (!options.force && state.statusGroups?.length && now - lastStatusLoadAt < 30000) {
      renderSidebarStatuses();
      renderStatusPanel();
      return state.statusGroups;
    }

    if (statusLoadPromise) {
      return statusLoadPromise;
    }

    statusLoadPromise = request("/api/status")
      .then((groups) => {
        state.statusGroups = Array.isArray(groups) ? groups : [];
        lastStatusLoadAt = Date.now();

        renderSidebarStatuses();
        renderStatusPanel();

        return state.statusGroups;
      })
      .finally(() => {
        statusLoadPromise = null;
      });

    return statusLoadPromise;
  }

function openStatusPanel() {
    ui.openModal("statusPanel");

    loadStatuses({ force: true }).catch((error) => {
      ui.showToast("error", error.message);
    });
  }

function closeStatusPanel() {
    ui.closeModal("statusPanel");
  }
