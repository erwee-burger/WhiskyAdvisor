"use client";

import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getBottleDisplayImage } from "@/lib/bottle-image";
import type { Briefing } from "@/lib/briefing-formatter";
import { formatBriefingAsMarkdown } from "@/lib/briefing-formatter";
import { formatTagLabel } from "@/lib/tags";
import type {
  CollectionViewItem,
  RelationshipType,
  TastingGroup,
  TastingPerson,
  TastingPlace,
  TastingSessionView
} from "@/lib/types";
import { formatDate, readResponseMessage } from "@/lib/utils";
import { TastingChat } from "@/components/tasting-chat";

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

function formatOccasionLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildBottleSearchHaystack(entry: CollectionViewItem) {
  return [
    entry.expression.name,
    entry.expression.brand,
    entry.expression.distilleryName,
    entry.expression.bottlerName,
    entry.expression.country,
    entry.item.fillState,
    ...entry.expression.tags
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getBottleImage(entry: CollectionViewItem) {
  return getBottleDisplayImage(entry.expression.name, entry.images);
}

function getBottleSubline(entry: CollectionViewItem) {
  return [entry.expression.distilleryName, entry.expression.brand, entry.expression.bottlerName]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter((value, index, array) => array.indexOf(value) === index)
    .join(" / ");
}

function getBottleFactLine(entry: CollectionViewItem) {
  return [
    typeof entry.expression.abv === "number" ? `${entry.expression.abv}% ABV` : null,
    typeof entry.expression.ageStatement === "number" ? `${entry.expression.ageStatement}yo` : null,
    entry.expression.country
  ]
    .filter(Boolean)
    .join(" · ");
}

function getBottleHighlightTags(entry: CollectionViewItem) {
  return [...new Set(entry.expression.tags.map((tag) => formatTagLabel(tag)))].slice(0, 2);
}

function SparkleIcon() {
  return (
    <svg aria-hidden="true" fill="currentColor" height="14" viewBox="0 0 24 24" width="14">
      <path d="m12 2 1.76 5.24L19 9l-5.24 1.76L12 16l-1.76-5.24L5 9l5.24-1.76L12 2Zm7 11 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3ZM5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Z" />
    </svg>
  );
}

function TastingSection({
  id,
  title,
  description,
  countLabel,
  open,
  onToggle,
  children,
  busy = false
}: {
  id?: string;
  title: string;
  description: string;
  countLabel?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  busy?: boolean;
}) {
  return (
    <section className={`panel stack tastings-section${busy ? " panel-busy" : ""}${open ? " tastings-section-open" : ""}`} id={id}>
      <button
        aria-expanded={open}
        className="tastings-section-toggle"
        onClick={onToggle}
        type="button"
      >
        <div className="tastings-section-toggle-copy">
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="tastings-section-toggle-side">
          {countLabel ? <span className="pill">{countLabel}</span> : null}
          <span className="tastings-section-chevron" aria-hidden="true">
            {open ? "−" : "+"}
          </span>
        </div>
      </button>
      {open ? <div className="tastings-section-body">{children}</div> : null}
    </section>
  );
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
  const [quickShareOpen, setQuickShareOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [placesOpen, setPlacesOpen] = useState(false);
  const [sessionBottleQuery, setSessionBottleQuery] = useState("");
  const [expandedSessionIds, setExpandedSessionIds] = useState<string[]>([]);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);

  const groupMembersById = useMemo(
    () => new Map(groups.map((group) => [group.id, group.memberPersonIds] as const)),
    [groups]
  );
  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.id, person] as const)),
    [people]
  );
  const availableBottleIds = useMemo(
    () => new Set(availableBottles.map((entry) => entry.item.id)),
    [availableBottles]
  );

  const { sessionBottleOptions, sessionBottleOptionsById, sessionBottleEntriesById } = useMemo(() => {
    const optionsById = new Map<string, SessionBottleOption>();
    const entriesById = new Map<string, CollectionViewItem>();

    for (const bottle of availableBottles) {
      optionsById.set(bottle.item.id, {
        itemId: bottle.item.id,
        label: toBottleOptionLabel(bottle),
        available: true
      });
      entriesById.set(bottle.item.id, bottle);
    }

    for (const sessionView of recentSessions) {
      for (const bottle of sessionView.bottles) {
        if (!optionsById.has(bottle.item.id)) {
          optionsById.set(bottle.item.id, {
            itemId: bottle.item.id,
            label: toBottleOptionLabel(bottle),
            available: availableBottleIds.has(bottle.item.id)
          });
        }

        if (!entriesById.has(bottle.item.id)) {
          entriesById.set(bottle.item.id, bottle);
        }
      }
    }

    for (const itemId of sessionForm.bottleItemIds) {
      if (!optionsById.has(itemId)) {
        optionsById.set(itemId, {
          itemId,
          label: `Unknown bottle (${itemId})`,
          available: false
        });
      }
    }

    return {
      sessionBottleOptions: [...optionsById.values()].sort((left, right) => left.label.localeCompare(right.label)),
      sessionBottleOptionsById: optionsById,
      sessionBottleEntriesById: entriesById
    };
  }, [availableBottles, availableBottleIds, recentSessions, sessionForm.bottleItemIds]);

  const filteredBottleResults = useMemo(() => {
    const normalized = sessionBottleQuery.trim().toLowerCase();
    const pool = availableBottles.filter((entry) =>
      normalized ? buildBottleSearchHaystack(entry).includes(normalized) : true
    );

    return pool.slice(0, normalized ? 18 : 12);
  }, [availableBottles, sessionBottleQuery]);

  const selectedSessionBottleCards = useMemo(
    () =>
      sessionForm.bottleItemIds.map((itemId) => ({
        itemId,
        option: sessionBottleOptionsById.get(itemId),
        entry: sessionBottleEntriesById.get(itemId)
      })),
    [sessionBottleEntriesById, sessionBottleOptionsById, sessionForm.bottleItemIds]
  );

  const hasUnavailableSelectedBottles = sessionForm.bottleItemIds.some(
    (itemId) => !sessionBottleOptionsById.get(itemId)?.available
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

  function toggleExpandedSession(sessionId: string) {
    setExpandedSessionIds((current) =>
      current.includes(sessionId)
        ? current.filter((entry) => entry !== sessionId)
        : [...current, sessionId]
    );
  }

  function toggleSessionBottle(itemId: string) {
    setSessionForm((current) => {
      const selected = current.bottleItemIds.includes(itemId);
      return {
        ...current,
        bottleItemIds: selected
          ? current.bottleItemIds.filter((entry) => entry !== itemId)
          : [...current.bottleItemIds, itemId]
      };
    });
  }

  function openSectionAndScroll(id: string, setter: Dispatch<SetStateAction<boolean>>) {
    setter(true);
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function resetQuickShareForm() {
    setQuickShare(createQuickShareForm(defaultBottleId));
  }

  function resetSessionForm() {
    setEditingSessionId(null);
    setSessionBottleQuery("");
    setSessionForm(createSessionForm());
  }

  async function handleGenerateBriefing() {
    if (sessionForm.bottleItemIds.length === 0) return;
    setIsBriefingLoading(true);
    try {
      const response = await fetch("/api/tastings/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bottleItemIds: sessionForm.bottleItemIds,
          placeId: sessionForm.placeId || null,
          groupId: sessionForm.groupId || null,
          attendeePersonIds: sessionForm.attendeePersonIds,
          occasionType: sessionForm.occasionType
        })
      });
      if (!response.ok) {
        setNotice({ tone: "error", text: "Could not generate briefing." });
        return;
      }
      const data = (await response.json()) as {
        suggestedName: string;
        briefing: Briefing;
      };
      setSessionForm((current) => ({
        ...current,
        title: current.title || data.suggestedName,
        notes: formatBriefingAsMarkdown(data.briefing)
      }));

      setNotice({ tone: "success", text: "Briefing generated. Review and edit before saving." });
    } catch {
      setNotice({ tone: "error", text: "Could not generate briefing." });
    } finally {
      setIsBriefingLoading(false);
    }
  }

  async function handleSuggestName() {
    if (sessionForm.bottleItemIds.length === 0) return;
    setIsBriefingLoading(true);
    try {
      const response = await fetch("/api/tastings/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bottleItemIds: sessionForm.bottleItemIds,
          placeId: sessionForm.placeId || null,
          groupId: sessionForm.groupId || null,
          attendeePersonIds: sessionForm.attendeePersonIds,
          occasionType: sessionForm.occasionType
        })
      });
      if (!response.ok) return;
      const data = (await response.json()) as { suggestedName: string };
      setSessionForm((current) => ({ ...current, title: data.suggestedName }));
    } catch {
      // silent — user can type manually
    } finally {
      setIsBriefingLoading(false);
    }
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
    setSessionOpen(true);
    setEditingSessionId(sessionView.session.id);
    setSessionBottleQuery("");
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
    requestAnimationFrame(() => {
      document.getElementById("log-session")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function startPersonEdit(person: TastingPerson) {
    setPeopleOpen(true);
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
    setGroupsOpen(true);
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
    setPlacesOpen(true);
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
      }
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
      successText: isEditing ? "Tasting session updated." : "Saved. Your tastings history is up to date.",
      errorText: isEditing ? "Could not update the tasting session." : "Could not save your changes.",
      body: {
        ...sessionForm,
        groupId: sessionForm.groupId || undefined,
        placeId: sessionForm.placeId || undefined,
        sessionDate: toIsoDatetime(sessionForm.sessionDate)
      }
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
      }
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
      }
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
      }
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

    setQuickShare((current) => (current.groupId === group.id ? { ...current, groupId: "" } : current));
    setSessionForm((current) => (current.groupId === group.id ? { ...current, groupId: "" } : current));
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

    setQuickShare((current) => (current.placeId === place.id ? { ...current, placeId: "" } : current));
    setSessionForm((current) => (current.placeId === place.id ? { ...current, placeId: "" } : current));
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
          <button className="button" onClick={() => openSectionAndScroll("quick-share", setQuickShareOpen)} type="button">
            Quick share
          </button>
          <button className="button-subtle" onClick={() => openSectionAndScroll("log-session", setSessionOpen)} type="button">
            Log session
          </button>
        </div>
      </section>

      <TastingChat
        onApply={(bottleItemIds) => {
          setSessionForm((current) => ({ ...current, bottleItemIds }));
          openSectionAndScroll("log-session", setSessionOpen);
        }}
      />

      {notice ? <div className={`status-note status-note-${notice.tone}`}>{notice.text}</div> : null}

      <TastingSection
        busy={isQuickShareBusy}
        description="Log one bottle you took somewhere without opening a full session form."
        id="quick-share"
        open={quickShareOpen}
        onToggle={() => setQuickShareOpen((current) => !current)}
        title="Quick share"
      >
        <form className="form-grid" onSubmit={handleQuickShareSubmit}>
          <div className="field">
            <label htmlFor="quick-share-bottle">Bottle</label>
            <select
              id="quick-share-bottle"
              onChange={(event) =>
                setQuickShare((current) => ({
                  ...current,
                  collectionItemId: event.target.value
                }))
              }
              value={quickShare.collectionItemId}
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
              onChange={(event) =>
                setQuickShare((current) => ({
                  ...current,
                  sessionDate: event.target.value
                }))
              }
              type="datetime-local"
              value={quickShare.sessionDate}
            />
          </div>
          <div className="field">
            <label htmlFor="quick-share-group">Group</label>
            <select
              id="quick-share-group"
              onChange={(event) =>
                setQuickShare((current) => ({
                  ...current,
                  groupId: event.target.value,
                  attendeePersonIds: event.target.value
                    ? getGroupMemberIds(event.target.value)
                    : current.attendeePersonIds
                }))
              }
              value={quickShare.groupId}
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
              onChange={(event) =>
                setQuickShare((current) => ({
                  ...current,
                  placeId: event.target.value
                }))
              }
              value={quickShare.placeId}
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
              onChange={(event) =>
                setQuickShare((current) => ({
                  ...current,
                  title: event.target.value
                }))
              }
              placeholder="Optional short label"
              value={quickShare.title}
            />
          </div>
          <div className="field full-span">
            <label htmlFor="quick-share-notes">Notes</label>
            <textarea
              id="quick-share-notes"
              onChange={(event) =>
                setQuickShare((current) => ({
                  ...current,
                  notes: event.target.value
                }))
              }
              placeholder="Optional context about the visit or how the bottle landed."
              value={quickShare.notes}
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
                      type="checkbox"
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
      </TastingSection>

      <TastingSection
        busy={isSessionBusy}
        description={
          editingSessionId
            ? "Update the linked bottles, attendees, and context for this tasting."
            : "Capture a full tasting with multiple bottles, attendees, and context."
        }
        id="log-session"
        open={sessionOpen}
        onToggle={() => setSessionOpen((current) => !current)}
        title={editingSessionId ? "Edit session" : "Log session"}
      >
        <form className="form-grid" onSubmit={handleSessionSubmit}>
          <div className="field">
            <label htmlFor="session-title">Title</label>
            <div className="tasting-input-with-action">
              <input
                id="session-title"
                onChange={(event) =>
                  setSessionForm((current) => ({
                    ...current,
                    title: event.target.value
                  }))
                }
                placeholder="Whisky Friday at home"
                value={sessionForm.title}
              />
              <button
                aria-label="Suggest a name with AI"
                className="detail-icon-button"
                disabled={sessionForm.bottleItemIds.length === 0 || isBriefingLoading}
                onClick={handleSuggestName}
                title="Suggest a session name"
                type="button"
              >
                <SparkleIcon />
              </button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="session-date">Date</label>
            <input
              id="session-date"
              onChange={(event) =>
                setSessionForm((current) => ({
                  ...current,
                  sessionDate: event.target.value
                }))
              }
              type="datetime-local"
              value={sessionForm.sessionDate}
            />
          </div>
          <div className="field">
            <label htmlFor="session-occasion">Occasion</label>
            <select
              id="session-occasion"
              onChange={(event) =>
                setSessionForm((current) => ({
                  ...current,
                  occasionType: event.target.value
                }))
              }
              value={sessionForm.occasionType}
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
              onChange={(event) =>
                setSessionForm((current) => ({
                  ...current,
                  groupId: event.target.value,
                  attendeePersonIds: event.target.value
                    ? getGroupMemberIds(event.target.value)
                    : current.attendeePersonIds
                }))
              }
              value={sessionForm.groupId}
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
              onChange={(event) =>
                setSessionForm((current) => ({
                  ...current,
                  placeId: event.target.value
                }))
              }
              value={sessionForm.placeId}
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
            <div className="tasting-label-with-action">
              <label htmlFor="session-notes">Notes</label>
              <button
                className="button-subtle tasting-briefing-btn"
                disabled={sessionForm.bottleItemIds.length === 0 || isBriefingLoading}
                onClick={handleGenerateBriefing}
                type="button"
              >
                {isBriefingLoading ? "Generating..." : "Generate briefing"}
              </button>
            </div>
            <textarea
              className="session-notes-editor"
              id="session-notes"
              onChange={(event) =>
                setSessionForm((current) => ({
                  ...current,
                  notes: event.target.value
                }))
              }
              placeholder="Anything worth remembering about the lineup or the company."
              value={sessionForm.notes}
            />
          </div>

          <div className="field full-span">
            <label htmlFor="session-bottle-search">Lineup</label>
            {hasUnavailableSelectedBottles ? (
              <div className="status-note status-note-error">
                This session includes bottles that are no longer shareable. Remove or replace them before saving.
              </div>
            ) : null}

            <div className="tasting-bottle-search">
              <input
                id="session-bottle-search"
                onChange={(event) => setSessionBottleQuery(event.target.value)}
                placeholder="Search by bottle, distillery, brand, or tag"
                value={sessionBottleQuery}
              />
            </div>

            <div className="tasting-selected-lineup">
              <div className="section-title">
                <div>
                  <h3>Selected lineup</h3>
                  <p>{selectedSessionBottleCards.length === 0 ? "Pick at least one bottle for this session." : `${selectedSessionBottleCards.length} bottles selected.`}</p>
                </div>
              </div>
              {selectedSessionBottleCards.length > 0 ? (
                <div className="tasting-selected-grid">
                  {selectedSessionBottleCards.map(({ itemId, option, entry }) => (
                    <article className={`tasting-selected-card${option?.available === false ? " tasting-selected-card-unavailable" : ""}`} key={itemId}>
                      <div className="tasting-selected-card-copy">
                        <strong>{entry?.expression.name ?? option?.label ?? `Unknown bottle (${itemId})`}</strong>
                        <p>{entry ? `${entry.item.fillState} · ${getBottleSubline(entry) || "Bottle from a previous session"}` : option?.available === false ? "No longer shareable for new sessions" : "Bottle metadata unavailable"}</p>
                      </div>
                      <button
                        className="button-subtle"
                        onClick={() => toggleSessionBottle(itemId)}
                        type="button"
                      >
                        Remove
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="status-note status-note-info">No bottles selected yet.</div>
              )}
            </div>

            <div className="tasting-bottle-picker">
              <div className="section-title">
                <div>
                  <h3>Choose from your shelf</h3>
                  <p>Search and tap bottles to build the tasting lineup.</p>
                </div>
              </div>
              {filteredBottleResults.length > 0 ? (
                <div className="tasting-bottle-grid">
                  {filteredBottleResults.map((entry) => {
                    const selected = sessionForm.bottleItemIds.includes(entry.item.id);

                    return (
                      <button
                        className={`tasting-bottle-card${selected ? " tasting-bottle-card-selected" : ""}`}
                        key={entry.item.id}
                        onClick={() => toggleSessionBottle(entry.item.id)}
                        type="button"
                      >
                        <div className="tasting-bottle-card-image">
                          <Image
                            alt={`${entry.expression.name} bottle`}
                            className="tasting-bottle-card-cutout"
                            height={120}
                            src={getBottleImage(entry)}
                            unoptimized
                            width={70}
                          />
                        </div>
                        <div className="tasting-bottle-card-copy">
                          <strong>{entry.expression.name}</strong>
                          {getBottleSubline(entry) ? <p>{getBottleSubline(entry)}</p> : null}
                          <div className="pill-row">
                            <span className="pill">{entry.item.fillState}</span>
                            <span className="pill">{entry.item.status}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="status-note status-note-info">No bottles matched that search.</div>
              )}
            </div>

            {sessionBottleOptions.some((option) => option.available === false && sessionForm.bottleItemIds.includes(option.itemId)) ? (
              <div className="tasting-unavailable-list">
                {sessionBottleOptions
                  .filter((option) => option.available === false && sessionForm.bottleItemIds.includes(option.itemId))
                  .map((option) => (
                    <span className="pill" key={option.itemId}>
                      {option.label}
                    </span>
                  ))}
              </div>
            ) : null}
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
                      type="checkbox"
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
      </TastingSection>

      <TastingSection
        countLabel={recentSessions.length === 1 ? "1 session" : `${recentSessions.length} sessions`}
        description="Compact summaries stay scannable. Open a session to inspect the full lineup, people, and notes."
        open={recentOpen}
        onToggle={() => setRecentOpen((current) => !current)}
        title="Recent sessions"
      >
        {recentSessions.length === 0 ? (
          <div className="status-note status-note-info">
            No tastings logged yet. Start with a quick share above and the history will appear here.
          </div>
        ) : (
          <div className="recent-session-list">
            {recentSessions.map((sessionView) => {
              const expanded = expandedSessionIds.includes(sessionView.session.id);
              const attendeeNames = sessionView.attendees.map((entry) => entry.name);
              const contextParts = [sessionView.group?.name, sessionView.place?.name].filter(Boolean);

              return (
                <article className={`recent-session-card${expanded ? " recent-session-card-expanded" : ""}`} key={sessionView.session.id}>
                  <button
                    aria-expanded={expanded}
                    className="recent-session-summary"
                    onClick={() => toggleExpandedSession(sessionView.session.id)}
                    type="button"
                  >
                    <div className="recent-session-summary-copy">
                      <h3>{sessionView.session.title ?? "Untitled tasting"}</h3>
                      <p>{formatDate(sessionView.session.sessionDate)}</p>
                    </div>
                    <div className="recent-session-summary-stats">
                      <span className="pill">{formatOccasionLabel(sessionView.session.occasionType)}</span>
                      <span className="pill">{sessionView.attendees.length || 1} people</span>
                      <span className="pill">{sessionView.bottles.length} bottles</span>
                      {contextParts.map((part) => (
                        <span className="pill" key={part}>
                          {part}
                        </span>
                      ))}
                      <span className="tastings-section-chevron" aria-hidden="true">
                        {expanded ? "-" : "+"}
                      </span>
                    </div>
                  </button>

                  {expanded ? (
                    <div className="recent-session-detail">
                      <div className="recent-session-overview">
                        <section className="recent-session-detail-block recent-session-context-block">
                          <h4>Context</h4>
                          <div className="recent-session-context-list">
                            <div>
                              <span className="muted">Occasion</span>
                              <strong>{formatOccasionLabel(sessionView.session.occasionType)}</strong>
                            </div>
                            {sessionView.group ? (
                              <div>
                                <span className="muted">Group</span>
                                <strong>{sessionView.group.name}</strong>
                              </div>
                            ) : null}
                            {sessionView.place ? (
                              <div>
                                <span className="muted">Place</span>
                                <strong>{sessionView.place.name}</strong>
                              </div>
                            ) : null}
                          </div>
                        </section>

                        <section className="recent-session-detail-block recent-session-people-block">
                          <h4>People</h4>
                          {attendeeNames.length > 0 ? (
                            <div className="recent-session-people-row">
                              {attendeeNames.map((name) => (
                                <span className="pill" key={name}>
                                  {name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="muted">Solo tasting.</p>
                          )}
                        </section>
                      </div>

                      <section className="recent-session-detail-block">
                        <h4>Bottles</h4>
                        <div className="recent-session-bottle-grid">
                          {sessionView.bottles.map((entry) => (
                            <article className="recent-session-bottle-card" key={entry.item.id}>
                              <div className="recent-session-bottle-image">
                                <Image
                                  alt={`${entry.expression.name} bottle`}
                                  className="recent-session-bottle-cutout"
                                  height={96}
                                  src={getBottleImage(entry)}
                                  unoptimized
                                  width={58}
                                />
                              </div>
                              <div className="recent-session-bottle-copy">
                                <strong className="recent-session-bottle-name">{entry.expression.name}</strong>
                                <p className="recent-session-bottle-subline">{getBottleSubline(entry) || "Bottle from your collection"}</p>
                                {getBottleFactLine(entry) ? (
                                  <p className="recent-session-bottle-facts">{getBottleFactLine(entry)}</p>
                                ) : null}
                                <div className="pill-row recent-session-bottle-pill-row">
                                  <span className="pill">{entry.item.fillState}</span>
                                  <span className="pill">{entry.item.status}</span>
                                  {getBottleHighlightTags(entry).map((tag) => (
                                    <span className="pill recent-session-bottle-tag" key={`${entry.item.id}-${tag}`}>
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      </section>

                      {sessionView.session.notes ? (
                        <section className="recent-session-detail-block">
                          <h4>Notes</h4>
                          <div className="recent-session-notes-scroll">
                            <div className="tasting-notes-markdown">
                              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{sessionView.session.notes}</ReactMarkdown>
                            </div>
                          </div>
                        </section>
                      ) : null}

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
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </TastingSection>

      <div className="stack">
        <TastingSection
          busy={isPersonBusy}
          countLabel={people.length === 1 ? "1 person" : `${people.length} people`}
          description="Keep simple relationship context and lightweight preference tags."
          open={peopleOpen}
          onToggle={() => setPeopleOpen((current) => !current)}
          title="People"
        >
          {editingPersonId ? (
            <div className="status-note status-note-info">You are editing a saved person record.</div>
          ) : null}
          <form className="stack" onSubmit={handlePersonSubmit}>
            <div className="field">
              <label htmlFor="person-name">Name</label>
              <input
                id="person-name"
                onChange={(event) =>
                  setPersonForm((current) => ({
                    ...current,
                    name: event.target.value
                  }))
                }
                value={personForm.name}
              />
            </div>
            <div className="field">
              <label htmlFor="person-relationship">Relationship</label>
              <select
                id="person-relationship"
                onChange={(event) =>
                  setPersonForm((current) => ({
                    ...current,
                    relationshipType: event.target.value as RelationshipType
                  }))
                }
                value={personForm.relationshipType}
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
                onChange={(event) =>
                  setPersonForm((current) => ({
                    ...current,
                    preferenceTags: event.target.value
                  }))
                }
                placeholder="peated, sherry, citrus"
                value={personForm.preferenceTags}
              />
            </div>
            <div className="field">
              <label htmlFor="person-notes">Notes</label>
              <textarea
                id="person-notes"
                onChange={(event) =>
                  setPersonForm((current) => ({
                    ...current,
                    notes: event.target.value
                  }))
                }
                value={personForm.notes}
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
        </TastingSection>

        <TastingSection
          busy={isGroupBusy}
          countLabel={groups.length === 1 ? "1 group" : `${groups.length} groups`}
          description="Reusable circles like whisky Friday crews, family, or office tastings."
          open={groupsOpen}
          onToggle={() => setGroupsOpen((current) => !current)}
          title="Groups"
        >
          {editingGroupId ? (
            <div className="status-note status-note-info">You are editing a saved group.</div>
          ) : null}
          <form className="stack" onSubmit={handleGroupSubmit}>
            <div className="field">
              <label htmlFor="group-name">Name</label>
              <input
                id="group-name"
                onChange={(event) =>
                  setGroupForm((current) => ({
                    ...current,
                    name: event.target.value
                  }))
                }
                value={groupForm.name}
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
                        type="checkbox"
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
                onChange={(event) =>
                  setGroupForm((current) => ({
                    ...current,
                    notes: event.target.value
                  }))
                }
                value={groupForm.notes}
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
        </TastingSection>

        <TastingSection
          busy={isPlaceBusy}
          countLabel={places.length === 1 ? "1 place" : `${places.length} places`}
          description="Keep the venues and homes that matter in the tastings story."
          open={placesOpen}
          onToggle={() => setPlacesOpen((current) => !current)}
          title="Places"
        >
          {editingPlaceId ? (
            <div className="status-note status-note-info">You are editing a saved place.</div>
          ) : null}
          <form className="stack" onSubmit={handlePlaceSubmit}>
            <div className="field">
              <label htmlFor="place-name">Name</label>
              <input
                id="place-name"
                onChange={(event) =>
                  setPlaceForm((current) => ({
                    ...current,
                    name: event.target.value
                  }))
                }
                value={placeForm.name}
              />
            </div>
            <div className="field">
              <label htmlFor="place-notes">Notes</label>
              <textarea
                id="place-notes"
                onChange={(event) =>
                  setPlaceForm((current) => ({
                    ...current,
                    notes: event.target.value
                  }))
                }
                value={placeForm.notes}
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
        </TastingSection>
      </div>
    </>
  );
}
