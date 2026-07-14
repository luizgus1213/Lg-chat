import type { StatusGroup, StatusPost, StatusUser } from "./status.schemas";

export function withCurrentAuthor(
  status: StatusPost,
  currentUser: StatusUser,
): StatusPost {
  return {
    ...status,
    viewedByMe: true,
    author: currentUser,
  };
}

export function addCreatedStatus(
  currentGroup: StatusGroup | null,
  status: StatusPost,
  currentUser: StatusUser,
): StatusGroup {
  const completeStatus = withCurrentAuthor(status, currentUser);
  const statuses = currentGroup
    ? [
        ...currentGroup.statuses.filter((item) => item.id !== status.id),
        completeStatus,
      ]
    : [completeStatus];

  return {
    user: currentUser,
    statuses,
    hasUnseen: false,
    lastCreatedAt: status.createdAt,
    isMine: true,
  };
}

export function removeStatusFromGroups(
  groups: StatusGroup[],
  statusId: number,
) {
  return groups.flatMap((group) => {
    const statuses = group.statuses.filter((status) => status.id !== statusId);
    if (statuses.length === 0) return [];
    return [
      {
        ...group,
        statuses,
        hasUnseen: statuses.some(
          (status) => !status.viewedByMe && !group.isMine,
        ),
        lastCreatedAt: statuses.at(-1)?.createdAt ?? group.lastCreatedAt,
      },
    ];
  });
}
