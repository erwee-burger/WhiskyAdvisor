"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { readResponseMessage, formatDate } from "@/lib/utils";
import type {
  CollectionViewItem,
  RelationshipType,
  TastingGroup,
  TastingPerson,
  TastingPlace,
  TastingSessionView
} from "@/lib/types";

type StatusNote = {
  tone: "success" | "error" | "info";
  text: string;
};

type QuickShareForm = {
  title: string;
  occasionType: string;
  sessionDate: string;
  collectionItemId: string;
  attendeePersonIds: string[];
  groupId: string;
  placeId: string;
  notes: string;
};

type SessionForm = {
  title: string;
  occasionType: string;
  sessionDate: string;
  bottleItemIds: string[];
  attendeePersonIds: string[];
  groupId: string;
  placeId: string;
  notes: string;
};

type PersonForm = {
  name: string;
  relationshipType: RelationshipType;
  preferenceTags: string;
  notes: string;
};

type GroupForm = {
  name: string;
  memberPersonIds: string[];
  notes: string;
};

type PlaceForm = {
  name: string;
  notes: string;
};

type SessionBottleOption = {
  itemId: string;
  label: string;
  available: boolean;
};

type Props = {
  recentSessions: TastingSessionView[];
  people: TastingPerson[];
  groups: TastingGroup[];
  places: TastingPlace[];
  availableBottles: CollectionViewItem[];
};

function toDatetimeLocalValue(value?: string) {
  const date = value ? new Date(value) : new Date();
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toIsoDatetime(value: string) {
  return new Date(value).toISOString();
}

function describeSession(view: TastingSessionView) {
  const attendees = view.attendees.map((entry) => entry.name).join(", ") || "Solo";
  const bottles = view.bottles.map((entry) => entry.expression.name).join(", ") || "No bottles linked";
  const context = [view.group?.name, view.place?.name].filter(Boolean).join(" - ");

  return {
    attendees,
    bottles,
    context
  };
}

function createQuickShareForm(collectionItemId: string): QuickShareForm {
  return {
    title: "",
    occasionType: "visit",
    sessionDate: toDatetimeLocalValue(),
    collectionItemId,
    attendeePersonIds: [],
    groupId: "",
    placeId: "",
    notes: ""
  };
}

function createSessionForm(): SessionForm {
  return {
    title: "",
    occasionType: "other",
    sessionDate: toDatetimeLocalValue(),
    bottleItemIds: [],
    attendeePersonIds: [],
    groupId: "",
    placeId: "",
    notes: ""
  };
}

function createPersonForm(): PersonForm {
  return {
    name: "",
    relationshipType: "other",
    preferenceTags: "",
    notes: ""
  };
}

function createGroupForm(): GroupForm {
  return {
    name: "",
    memberPersonIds: [],
    notes: ""
  };
}

function createPlaceForm(): PlaceForm {
  return {
    name: "",
    notes: ""
  };
}

function toggleIdSelection(values: string[], value: string, checked: boolean) {
  return checked ? [...new Set([...values, value])] : values.filter((entry) => entry !== value);
}

function toBottleOptionLabel(entry: CollectionViewItem) {
  return `${entry.expression.name} (${entry.item.fillState})`;
}

export function TastingsHub({
  recentSessions,
  people,
  groups,
  places,
  availableBottles
}: Props) {
  const router = useRouter();
  const defaultBottleId = availableBottles[0]?.item.id ?? "";
  const [notice, setNotice] = useState<StatusNote | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [quickShare, setQuickShare] = useState<QuickShareForm>(() =>
    createQuickShareForm(defaultBottleId)
  );
  const [sessionForm, setSessionForm] = useState<SessionForm>(() => createSessionForm());
  const [personForm, setPersonForm] = useState<PersonForm>(() => createPersonForm());
  const [groupForm, setGroupForm] = useState<GroupForm>(() => createGroupForm());
  const [placeForm, setPlaceForm] = useState<PlaceForm>(() => createPlaceForm());
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null);

  const groupMembersById = new Map(groups.map((group) => [group.id, group.memberPersonIds] as const));
  const peopleById = new Map(people.map((person) => [person.id, person] as const));
  const availableBottleIds = new Set(availableBottles.map((entry) => entry.item.id));
  const sessionBottleOptionsById = new Map<string, SessionBottleOption>();

  for (const bottle of availableBottles) {
    sessionBottleOptionsById.set(bottle.item.id, {
      itemId: bottle.item.id,
      label: toBottleOptionLabel(bottle),
      available: true
    });
  }

  for (const sessionView of recentSessions) {
    for (const bottle of sessionView.bottles) {
      if (!sessionBottleOptionsById.has(bottle.item.id)) {
        sessionBottleOptionsById.set(bottle.item.id, {
          itemId: bottle.item.id,
          label: toBottleOptionLabel(bottle),
          available: availableBottleIds.has(bottle.item.id)
        });
      }
    }
  }

  for (const itemId of sessionForm.bottleItemIds) {
    if (!sessionBottleOptionsById.has(itemId)) {
      sessionBottleOptionsById.set(itemId, {
        itemId,
        label: `Unknown bottle (${itemId})`,
        available: false
      });
    }
  }

  const sessionBottleOptions = [...sessionBottleOptionsById.values()].sort((left, right) =>
    left.label.localeCompare(right.label)
  );
  const hasUnavailableSelectedBottles = sessionForm.bottleItemIds.some(
    (itemId) => !availableBottleIds.has(itemId)
  );
  const hasQuickShareAttendees = quickShare.attendeePersonIds.length > 0;
  const canSubmitSession = sessionForm.bottleItemIds.length > 0 && !hasUnavailableSelectedBottles;
  const isQuickShareBusy = busyAction === "quick-share";
  const isSessionBusy = busyAction?.startsWith("session") ?? false;
  const isPersonBusy = busyAction?.startsWith("person") ?? false;
  const isGroupBusy = busyAction?.startsWith("group") ?? false;
  const isPlaceBusy = busyAction?.startsWith("place") ?? false;

  function getGroupMemberIds(groupId: string) {
    if (!groupId) {
      return [];
    }

    return [...new Set(groupMembersById.get(groupId) ?? [])];
  }

  function resetQuickShareForm() {
    setQuickShare(createQuickShareForm(defaultBottleId));
  }

  function resetSessionForm() {
    setEditingSessionId(null);
    setSessionForm(createSessionForm());
  }

  function resetPersonForm() {
    setEditingPersonId(null);
    setPersonForm(createPersonForm());
  }

  function resetGroupForm() {
    setEditingGroupId(null);
    setGroupForm(createGroupForm());
  }

  function resetPlaceForm() {
    setEditingPlaceId(null);
    setPlaceForm(createPlaceForm());
  }

  async function sendRequest({
    url,
    method,
    action,
    successText,
    errorText,
    body
  }: {
    url: string;
    method: "POST" | "PATCH" | "DELETE";
    action: string;
    successText: string;
    errorText: string;
    body?: object;
  }) {
    setNotice(null);
    setBusyAction(action);

    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });

      if (!response.ok) {
        throw new Error(await readResponseMessage(response, errorText));
      }

      setNotice({ tone: "success", text: successText });
      router.refresh();
      return true;
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : errorText
      });
      return false;
    } finally {
      setBusyAction(null);
    }
  }

  function startSessionEdit(sessionView: TastingSessionView) {
    setEditingSessionId(sessionView.session.id);
    setSessionForm({
      title: sessionView.session.title ?? "",
      occasionType: sessionView.session.occasionType,
      sessionDate: toDatetimeLocalValue(sessionView.session.sessionDate),
      bottleItemIds: sessionView.bottles.map((entry) => entry.item.id),
      attendeePersonIds: sessionView.attendees.map((entry) => entry.id),
      groupId: sessionView.group?.id ?? "",
      placeId: sessionView.place?.id ?? "",
      notes: sessionView.session.notes ?? ""
    });
    setNotice({
      tone: "info",
      text: "Editing tasting session. Save to apply changes, or cancel to discard them."
    });
  }

  function startPersonEdit(person: TastingPerson) {
    setEditingPersonId(person.id);
    setPersonForm({
      name: person.name,
      relationshipType: person.relationshipType,
      preferenceTags: person.preferenceTags.join(", "),
      notes: person.notes ?? ""
    });
    setNotice({
      tone: "info",
      text: `Editing ${person.name}. Save to apply changes, or cancel to discard them.`
    });
  }

  function startGroupEdit(group: TastingGroup) {
    setEditingGroupId(group.id);
    setGroupForm({
      name: group.name,
      memberPersonIds: [...group.memberPersonIds],
      notes: group.notes ?? ""
    });
    setNotice({
      tone: "info",
      text: `Editing ${group.name}. Save to apply changes, or cancel to discard them.`
    });
  }

  function startPlaceEdit(place: TastingPlace) {
    setEditingPlaceId(place.id);
    setPlaceForm({
      name: place.name,
      notes: place.notes ?? ""
    });
    setNotice({
      tone: "info",
      text: `Editing ${place.name}. Save to apply changes, or cancel to discard them.`
    });
  }

  async function handleQuickShareSubmit(event: React.FormEvent) {
    event.preventDefault();

    const ok = await sendRequest({
      url: "/api/tastings/sessions",
      method: "POST",
      action: "quick-share",
      successText: "Saved. Your tastings history is up to date.",
      errorText: "Could not save your changes.",
      body: {
        ...quickShare,
        groupId: quickShare.groupId || undefined,
        placeId: quickShare.placeId || undefined,
        sessionDate: toIsoDatetime(quickShare.sessionDate)
      },
    });

    if (ok) {
      resetQuickShareForm();
    }
  }

  async function handleSessionSubmit(event: React.FormEvent) {
    event.preventDefault();

    const isEditing = editingSessionId !== null;
    const ok = await sendRequest({
      url: isEditing ? `/api/tastings/sessions/${editingSessionId}` : "/api/tastings/sessions",
      method: isEditing ? "PATCH" : "POST",
      action: "session-save",
      successText: isEditing
        ? "Tasting session updated."
        : "Saved. Your tastings history is up to date.",
      errorText: isEditing
        ? "Could not update the tasting session."
        : "Could not save your changes.",
      body: {
        ...sessionForm,
        groupId: sessionForm.groupId || undefined,
        placeId: sessionForm.placeId || undefined,
        sessionDate: toIsoDatetime(sessionForm.sessionDate)
      },
    });

    if (ok) {
      resetSessionForm();
    }
  }

  async function handlePersonSubmit(event: React.FormEvent) {
    event.preventDefault();

    const isEditing = editingPersonId !== null;
    const ok = await sendRequest({
      url: isEditing ? `/api/tastings/people/${editingPersonId}` : "/api/tastings/people",
      method: isEditing ? "PATCH" : "POST",
      action: "person-save",
      successText: isEditing ? "Person updated." : "Person saved.",
      errorText: isEditing ? "Could not update the person." : "Could not save the person.",
      body: {
        ...personForm,
        notes: personForm.notes || undefined,
        preferenceTags: personForm.preferenceTags
      },
    });

    if (ok) {
      resetPersonForm();
    }
  }

  async function handleGroupSubmit(event: React.FormEvent) {
    event.preventDefault();

    const isEditing = editingGroupId !== null;
    const ok = await sendRequest({
      url: isEditing ? `/api/tastings/groups/${editingGroupId}` : "/api/tastings/groups",
      method: isEditing ? "PATCH" : "POST",
      action: "group-save",
      successText: isEditing ? "Group updated." : "Group saved.",
      errorText: isEditing ? "Could not update the group." : "Could not save the group.",
      body: {
        ...groupForm,
        notes: groupForm.notes || undefined
      },
    });

    if (ok) {
      resetGroupForm();
    }
  }

  async function handlePlaceSubmit(event: React.FormEvent) {
    event.preventDefault();

    const isEditing = editingPlaceId !== null;
    const ok = await sendRequest({
      url: isEditing ? `/api/tastings/places/${editingPlaceId}` : "/api/tastings/places",
      method: isEditing ? "PATCH" : "POST",
      action: "place-save",
      successText: isEditing ? "Place updated." : "Place saved.",
      errorText: isEditing ? "Could not update the place." : "Could not save the place.",
      body: {
        ...placeForm,
        notes: placeForm.notes || undefined
      },
    });

    if (ok) {
      resetPlaceForm();
    }
  }

  async function handleDeleteSession(sessionId: string) {
    if (!window.confirm("Delete this tasting session?")) {
      return;
    }

    const ok = await sendRequest({
      url: `/api/tastings/sessions/${sessionId}`,
      method: "DELETE",
      action: `session-delete-${sessionId}`,
      successText: "Tasting session deleted.",
      errorText: "Could not delete the tasting session."
    });

    if (ok && editingSessionId === sessionId) {
      resetSessionForm();
    }
  }

  async function handleDeletePerson(person: TastingPerson) {
    if (!window.confirm(`Delete ${person.name}?`)) {
      return;
    }

    const ok = await sendRequest({
      url: `/api/tastings/people/${person.id}`,
      method: "DELETE",
      action: `person-delete-${person.id}`,
      successText: "Person deleted.",
      errorText: "Could not delete the person."
    });

    if (!ok) {
      return;
    }

    if (editingPersonId === person.id) {
      resetPersonForm();
    }

    setQuickShare((current) => ({
      ...current,
      attendeePersonIds: current.attendeePersonIds.filter((entry) => entry !== person.id)
    }));
    setSessionForm((current) => ({
      ...current,
      attendeePersonIds: current.attendeePersonIds.filter((entry) => entry !== person.id)
    }));
    setGroupForm((current) => ({
      ...current,
      memberPersonIds: current.memberPersonIds.filter((entry) => entry !== person.id)
    }));
  }

  async function handleDeleteGroup(group: TastingGroup) {
    if (!window.confirm(`Delete ${group.name}? Existing sessions will keep attendees but lose the group link.`)) {
      return;
    }

    const ok = await sendRequest({
      url: `/api/tastings/groups/${group.id}`,
      method: "DELETE",
      action: `group-delete-${group.id}`,
      successText: "Group deleted.",
      errorText: "Could not delete the group."
    });

    if (!ok) {
      return;
    }

    if (editingGroupId === group.id) {
      resetGroupForm();
    }

    setQuickShare((current) =>
      current.groupId === group.id ? { ...current, groupId: "" } : current
    );
    setSessionForm((current) =>
      current.groupId === group.id ? { ...current, groupId: "" } : current
    );
  }

  async function handleDeletePlace(place: TastingPlace) {
    if (!window.confirm(`Delete ${place.name}? Existing sessions will keep history but lose the place link.`)) {
      return;
    }

    const ok = await sendRequest({
      url: `/api/tastings/places/${place.id}`,
      method: "DELETE",
      action: `place-delete-${place.id}`,
      successText: "Place deleted.",
      errorText: "Could not delete the place."
    });

    if (!ok) {
      return;
    }

    if (editingPlaceId === place.id) {
      resetPlaceForm();
    }

    setQuickShare((current) =>
      current.placeId === place.id ? { ...current, placeId: "" } : current
    );
    setSessionForm((current) =>
      current.placeId === place.id ? { ...current, placeId: "" } : current
    );
  }

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Tastings</p>
        <h1>Your social memory for the shelf.</h1>
        <p>
          Track whisky Fridays, family visits, bottles you took to friends, and the people who
          keep coming back for certain styles. The advisor can use that history to plan what to
          bring next.
        </p>
        <div className="hero-actions">
          <a className="button" href="#quick-share">
            Quick share
          </a>
          <a className="button-subtle" href="#log-session">
            Log session
          </a>
          <a className="button-subtle" href="/advisor">
            Ask advisor what to take
          </a>
        </div>
      </section>

      {notice ? <div className={`status-note status-note-${notice.tone}`}>{notice.text}</div> : null}

      <section className={`panel stack${isQuickShareBusy ? " panel-busy" : ""}`} id="quick-share">
        <div className="section-title">
          <div>
            <h2>Quick share</h2>
            <p>Log one bottle you took somewhere without opening a full session form.</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={handleQuickShareSubmit}>
          <div className="field">
            <label htmlFor="quick-share-bottle">Bottle</label>
            <select
              id="quick-share-bottle"
              value={quickShare.collectionItemId}
              onChange={(event) =>
                setQuickShare((current) => ({
                  ...current,
                  collectionItemId: event.target.value
                }))
              }
            >
              {availableBottles.map((entry) => (
                <option key={entry.item.id} value={entry.item.id}>
                  {toBottleOptionLabel(entry)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="quick-share-date">Date</label>
            <input
              id="quick-share-date"
              type="datetime-local"
              value={quickShare.sessionDate}
              onChange={(event) =>
                setQuickShare((current) => ({
                  ...current,
                  sessionDate: event.target.value
                }))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="quick-share-group">Group</label>
            <select
              id="quick-share-group"
              value={quickShare.groupId}
              onChange={(event) =>
                setQuickShare((current) => ({
                  ...current,
                  groupId: event.target.value,
                  attendeePersonIds: event.target.value
                    ? getGroupMemberIds(event.target.value)
                    : current.attendeePersonIds
                }))
              }
            >
              <option value="">No linked group</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="quick-share-place">Place</label>
            <select
              id="quick-share-place"
              value={quickShare.placeId}
              onChange={(event) =>
                setQuickShare((current) => ({
                  ...current,
                  placeId: event.target.value
                }))
              }
            >
              <option value="">No place set</option>
              {places.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field full-span">
            <label htmlFor="quick-share-title">Title</label>
            <input
              id="quick-share-title"
              placeholder="Optional short label"
              value={quickShare.title}
              onChange={(event) =>
                setQuickShare((current) => ({
                  ...current,
                  title: event.target.value
                }))
              }
            />
          </div>
          <div className="field full-span">
            <label htmlFor="quick-share-notes">Notes</label>
            <textarea
              id="quick-share-notes"
              placeholder="Optional context about the visit or how the bottle landed."
              value={quickShare.notes}
              onChange={(event) =>
                setQuickShare((current) => ({
                  ...current,
                  notes: event.target.value
                }))
              }
            />
          </div>
          <div className="field full-span">
            <label>People</label>
            {quickShare.groupId && !hasQuickShareAttendees ? (
              <div className="status-note status-note-error">
                The selected group has no members. Add at least one attendee before saving.
              </div>
            ) : null}
            <div className="tastings-checklist">
              {people.length === 0 ? (
                <div className="status-note status-note-info">Add a person below before using quick share.</div>
              ) : (
                people.map((person) => (
                  <label className="checkbox-label" key={person.id}>
                    <input
                      type="checkbox"
                      checked={quickShare.attendeePersonIds.includes(person.id)}
                      onChange={(event) =>
                        setQuickShare((current) => ({
                          ...current,
                          attendeePersonIds: toggleIdSelection(
                            current.attendeePersonIds,
                            person.id,
                            event.target.checked
                          )
                        }))
                      }
                    />
                    <span>
                      {person.name}
                      {person.preferenceTags.length > 0 ? ` - likes ${person.preferenceTags.join(", ")}` : ""}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
          <div className="full-span editor-actions">
            <button
              className={`button${isQuickShareBusy ? " button-active" : ""}`}
              disabled={busyAction !== null || !quickShare.collectionItemId || !hasQuickShareAttendees}
              type="submit"
            >
              Log taking this bottle
            </button>
          </div>
        </form>
      </section>

      <section className={`panel stack${isSessionBusy ? " panel-busy" : ""}`} id="log-session">
        <div className="section-title">
          <div>
            <h2>{editingSessionId ? "Edit session" : "Log session"}</h2>
            <p>
              {editingSessionId
                ? "Update the linked bottles, attendees, and context for this tasting."
                : "Capture a full tasting with multiple bottles, attendees, and context."}
            </p>
          </div>
        </div>
        <form className="form-grid" onSubmit={handleSessionSubmit}>
          <div className="field">
            <label htmlFor="session-title">Title</label>
            <input
              id="session-title"
              placeholder="Whisky Friday at home"
              value={sessionForm.title}
              onChange={(event) =>
                setSessionForm((current) => ({
                  ...current,
                  title: event.target.value
                }))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="session-date">Date</label>
            <input
              id="session-date"
              type="datetime-local"
              value={sessionForm.sessionDate}
              onChange={(event) =>
                setSessionForm((current) => ({
                  ...current,
                  sessionDate: event.target.value
                }))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="session-occasion">Occasion</label>
            <select
              id="session-occasion"
              value={sessionForm.occasionType}
              onChange={(event) =>
                setSessionForm((current) => ({
                  ...current,
                  occasionType: event.target.value
                }))
              }
            >
              <option value="visit">Visit</option>
              <option value="whisky_friday">Whisky Friday</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="session-group">Group</label>
            <select
              id="session-group"
              value={sessionForm.groupId}
              onChange={(event) =>
                setSessionForm((current) => ({
                  ...current,
                  groupId: event.target.value,
                  attendeePersonIds: event.target.value
                    ? getGroupMemberIds(event.target.value)
                    : current.attendeePersonIds
                }))
              }
            >
              <option value="">No linked group</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="session-place">Place</label>
            <select
              id="session-place"
              value={sessionForm.placeId}
              onChange={(event) =>
                setSessionForm((current) => ({
                  ...current,
                  placeId: event.target.value
                }))
              }
            >
              <option value="">No place set</option>
              {places.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field full-span">
            <label htmlFor="session-notes">Notes</label>
            <textarea
              id="session-notes"
              placeholder="Anything worth remembering about the lineup or the company."
              value={sessionForm.notes}
              onChange={(event) =>
                setSessionForm((current) => ({
                  ...current,
                  notes: event.target.value
                }))
              }
            />
          </div>
          <div className="field full-span">
            <label>Bottles</label>
            {hasUnavailableSelectedBottles ? (
              <div className="status-note status-note-error">
                This session includes bottles that are no longer shareable. Remove or replace them
                before saving.
              </div>
            ) : null}
            <div className="tastings-checklist">
              {sessionBottleOptions.map((bottle) => {
                const isSelected = sessionForm.bottleItemIds.includes(bottle.itemId);
                const isDisabled = !bottle.available && !isSelected;

                return (
                  <label className="checkbox-label" key={bottle.itemId}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isDisabled}
                      onChange={(event) =>
                        setSessionForm((current) => ({
                          ...current,
                          bottleItemIds: toggleIdSelection(
                            current.bottleItemIds,
                            bottle.itemId,
                            event.target.checked
                          )
                        }))
                      }
                    />
                    <span>
                      {bottle.label}
                      {!bottle.available ? " - currently unavailable for new sessions" : ""}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="field full-span">
            <label>Attendees</label>
            <div className="tastings-checklist">
              {people.length === 0 ? (
                <div className="status-note status-note-info">Add people below, or leave this empty for a solo session.</div>
              ) : (
                people.map((person) => (
                  <label className="checkbox-label" key={person.id}>
                    <input
                      type="checkbox"
                      checked={sessionForm.attendeePersonIds.includes(person.id)}
                      onChange={(event) =>
                        setSessionForm((current) => ({
                          ...current,
                          attendeePersonIds: toggleIdSelection(
                            current.attendeePersonIds,
                            person.id,
                            event.target.checked
                          )
                        }))
                      }
                    />
                    <span>
                      {person.name}
                      {person.preferenceTags.length > 0 ? ` - likes ${person.preferenceTags.join(", ")}` : ""}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
          <div className="full-span editor-actions">
            <button
              className={`button${isSessionBusy ? " button-active" : ""}`}
              disabled={busyAction !== null || !canSubmitSession}
              type="submit"
            >
              {editingSessionId ? "Update tasting session" : "Save tasting session"}
            </button>
            {editingSessionId ? (
              <button className="button-subtle" disabled={busyAction !== null} onClick={resetSessionForm} type="button">
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="panel stack">
        <div className="section-title">
          <div>
            <h2>Recent sessions</h2>
            <p>The latest shared-drinking history across people, places, and bottles.</p>
          </div>
        </div>
        {recentSessions.length === 0 ? (
          <div className="status-note status-note-info">
            No tastings logged yet. Start with a quick share above and the history will appear here.
          </div>
        ) : (
          <div className="card-list">
            {recentSessions.map((sessionView) => {
              const { attendees, bottles, context } = describeSession(sessionView);

              return (
                <article className="advisor-card stack" key={sessionView.session.id}>
                  <div className="section-title">
                    <div>
                      <h3>{sessionView.session.title ?? "Untitled tasting"}</h3>
                      <p>{formatDate(sessionView.session.sessionDate)}</p>
                    </div>
                  </div>
                  <div className="meta-line">
                    <span>{attendees}</span>
                    {context ? <span>{context}</span> : null}
                    <span>{sessionView.session.occasionType.replace("_", " ")}</span>
                  </div>
                  <p className="muted">{bottles}</p>
                  {sessionView.session.notes ? <p>{sessionView.session.notes}</p> : null}
                  <div className="editor-actions">
                    <button
                      className="button-subtle"
                      disabled={busyAction !== null}
                      onClick={() => startSessionEdit(sessionView)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="button-danger"
                      disabled={busyAction !== null}
                      onClick={() => void handleDeleteSession(sessionView.session.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid columns-3 tastings-directory-grid">
        <div className={`panel stack${isPersonBusy ? " panel-busy" : ""}`}>
          <div className="section-title">
            <div>
              <h2>People</h2>
              <p>Keep simple relationship context and lightweight preference tags.</p>
            </div>
          </div>
          {editingPersonId ? (
            <div className="status-note status-note-info">You are editing a saved person record.</div>
          ) : null}
          <form className="stack" onSubmit={handlePersonSubmit}>
            <div className="field">
              <label htmlFor="person-name">Name</label>
              <input
                id="person-name"
                value={personForm.name}
                onChange={(event) =>
                  setPersonForm((current) => ({
                    ...current,
                    name: event.target.value
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="person-relationship">Relationship</label>
              <select
                id="person-relationship"
                value={personForm.relationshipType}
                onChange={(event) =>
                  setPersonForm((current) => ({
                    ...current,
                    relationshipType: event.target.value as RelationshipType
                  }))
                }
              >
                <option value="friend">Friend</option>
                <option value="family">Family</option>
                <option value="colleague">Colleague</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="person-tags">Preference tags</label>
              <input
                id="person-tags"
                placeholder="peated, sherry, citrus"
                value={personForm.preferenceTags}
                onChange={(event) =>
                  setPersonForm((current) => ({
                    ...current,
                    preferenceTags: event.target.value
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="person-notes">Notes</label>
              <textarea
                id="person-notes"
                value={personForm.notes}
                onChange={(event) =>
                  setPersonForm((current) => ({
                    ...current,
                    notes: event.target.value
                  }))
                }
              />
            </div>
            <div className="editor-actions">
              <button className="button" disabled={busyAction !== null} type="submit">
                {editingPersonId ? "Update person" : "Save person"}
              </button>
              {editingPersonId ? (
                <button className="button-subtle" disabled={busyAction !== null} onClick={resetPersonForm} type="button">
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>
          <div className="card-list">
            {people.map((person) => (
              <article className="review-item" key={person.id}>
                <div className="review-item-head">
                  <strong>{person.name}</strong>
                  <span className="muted">{person.relationshipType}</span>
                </div>
                {person.preferenceTags.length > 0 ? (
                  <div className="pill-row">
                    {person.preferenceTags.map((tag) => (
                      <span className="pill" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                {person.notes ? <p>{person.notes}</p> : null}
                <div className="editor-actions">
                  <button
                    className="button-subtle"
                    disabled={busyAction !== null}
                    onClick={() => startPersonEdit(person)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="button-danger"
                    disabled={busyAction !== null}
                    onClick={() => void handleDeletePerson(person)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className={`panel stack${isGroupBusy ? " panel-busy" : ""}`}>
          <div className="section-title">
            <div>
              <h2>Groups</h2>
              <p>Reusable circles like whisky Friday crews, family, or office tastings.</p>
            </div>
          </div>
          {editingGroupId ? (
            <div className="status-note status-note-info">You are editing a saved group.</div>
          ) : null}
          <form className="stack" onSubmit={handleGroupSubmit}>
            <div className="field">
              <label htmlFor="group-name">Name</label>
              <input
                id="group-name"
                value={groupForm.name}
                onChange={(event) =>
                  setGroupForm((current) => ({
                    ...current,
                    name: event.target.value
                  }))
                }
              />
            </div>
            <div className="field">
              <label>Members</label>
              <div className="tastings-checklist">
                {people.length === 0 ? (
                  <div className="status-note status-note-info">Add people first to build reusable groups.</div>
                ) : (
                  people.map((person) => (
                    <label className="checkbox-label" key={person.id}>
                      <input
                        type="checkbox"
                        checked={groupForm.memberPersonIds.includes(person.id)}
                        onChange={(event) =>
                          setGroupForm((current) => ({
                            ...current,
                            memberPersonIds: toggleIdSelection(
                              current.memberPersonIds,
                              person.id,
                              event.target.checked
                            )
                          }))
                        }
                      />
                      <span>{person.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="field">
              <label htmlFor="group-notes">Notes</label>
              <textarea
                id="group-notes"
                value={groupForm.notes}
                onChange={(event) =>
                  setGroupForm((current) => ({
                    ...current,
                    notes: event.target.value
                  }))
                }
              />
            </div>
            <div className="editor-actions">
              <button className="button" disabled={busyAction !== null} type="submit">
                {editingGroupId ? "Update group" : "Save group"}
              </button>
              {editingGroupId ? (
                <button className="button-subtle" disabled={busyAction !== null} onClick={resetGroupForm} type="button">
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>
          <div className="card-list">
            {groups.map((group) => (
              <article className="review-item" key={group.id}>
                <div className="review-item-head">
                  <strong>{group.name}</strong>
                  <span className="muted">{group.memberPersonIds.length} members</span>
                </div>
                <p>
                  {group.memberPersonIds
                    .map((personId) => peopleById.get(personId)?.name ?? "Unknown")
                    .join(", ") || "No members yet"}
                </p>
                {group.notes ? <p>{group.notes}</p> : null}
                <div className="editor-actions">
                  <button
                    className="button-subtle"
                    disabled={busyAction !== null}
                    onClick={() => startGroupEdit(group)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="button-danger"
                    disabled={busyAction !== null}
                    onClick={() => void handleDeleteGroup(group)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className={`panel stack${isPlaceBusy ? " panel-busy" : ""}`}>
          <div className="section-title">
            <div>
              <h2>Places</h2>
              <p>Keep the venues and homes that matter in the tastings story.</p>
            </div>
          </div>
          {editingPlaceId ? (
            <div className="status-note status-note-info">You are editing a saved place.</div>
          ) : null}
          <form className="stack" onSubmit={handlePlaceSubmit}>
            <div className="field">
              <label htmlFor="place-name">Name</label>
              <input
                id="place-name"
                value={placeForm.name}
                onChange={(event) =>
                  setPlaceForm((current) => ({
                    ...current,
                    name: event.target.value
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="place-notes">Notes</label>
              <textarea
                id="place-notes"
                value={placeForm.notes}
                onChange={(event) =>
                  setPlaceForm((current) => ({
                    ...current,
                    notes: event.target.value
                  }))
                }
              />
            </div>
            <div className="editor-actions">
              <button className="button" disabled={busyAction !== null} type="submit">
                {editingPlaceId ? "Update place" : "Save place"}
              </button>
              {editingPlaceId ? (
                <button className="button-subtle" disabled={busyAction !== null} onClick={resetPlaceForm} type="button">
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>
          <div className="card-list">
            {places.map((place) => (
              <article className="review-item" key={place.id}>
                <div className="review-item-head">
                  <strong>{place.name}</strong>
                </div>
                {place.notes ? <p>{place.notes}</p> : <p className="muted">No notes yet.</p>}
                <div className="editor-actions">
                  <button
                    className="button-subtle"
                    disabled={busyAction !== null}
                    onClick={() => startPlaceEdit(place)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="button-danger"
                    disabled={busyAction !== null}
                    onClick={() => void handleDeletePlace(place)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
