function init() {
    enablePerformanceMode();
    observeLazyMedia();
    patchFetchTiming();
    bindNetworkHints();
    bindVisibleRefresh();
    cleanupOldLocalCaches();
    observeVideosForPerformance();
    bindVisibilityMemoryCleanup();
  }

window.LGChat.performance = {
    init,
    scheduleIdle,
    runWhenIdle,
    enablePerformanceMode,
    makeMediaLazy,
    observeLazyMedia,
    scheduleLoadChats,
    directLoadChats,
    debounce,
    throttle,
    appendFragmentInChunks,
  };
