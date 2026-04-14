"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { formatDate, readResponseMessage } from "@/lib/utils";
import type { BottleSocialSummary, TastingGroup, TastingPerson, TastingPlace } from "@/lib/types";

type Props = {
  canQuickShare: boolean;
  itemId: string;
  summary: BottleSocialSummary;
  people: TastingPerson[];
  groups: TastingGroup[];
  places: TastingPlace[];
};

type Notice = {
  tone: "success" | "error";
  text: string;
};

function toDatetimeLocalValue(value?: string) {
  const date = value ? new Date(value) : new Date();
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toIsoDatetime(value: string) {
  return new Date(value).toISOString();
}

function toggleIdSelection(values: string[], value: string, checked: boolean) {
  return checked ? [...new Set([...values, value])] : values.filter((entry) => entry !== value);
}

export function BottleSharingHistory({
  canQuickShare,
  itemId,
  summary,
  people,
  groups,
  places
}: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [form, setForm] = useState({
    title: "",
    occasionType: "visit",
    sessionDate: toDatetimeLocalValue(),
    attendeePersonIds: [] as string[],
    groupId: "",
    placeId: "",
    notes: ""
  });

  const groupMembersById = new Map(groups.map((group) => [group.id, group.memberPersonIds] as const));
  const hasAttendees = form.attendeePersonIds.length > 0;

  function getGroupMemberIds(groupId: string) {
    if (!groupId) {
      return [];
    }

    return [...new Set(groupMembersById.get(groupId) ?? [])];
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setNotice(null);

    try {
      const response = await fetch("/api/tastings/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          groupId: form.groupId || undefined,
          placeId: form.placeId || undefined,
          sessionDate: toIsoDatetime(form.sessionDate),
          collectionItemId: itemId
        })
      });

      if (!response.ok) {
        throw new Error(await readResponseMessage(response, "Could not log this bottle share."));
      }

      setForm((current) => ({
        ...current,
        title: "",
        attendeePersonIds: [],
        groupId: "",
        placeId: "",
        notes: ""
      }));
      setNotice({ tone: "success", text: "Bottle share logged." });
      setIsOpen(false);
      router.refresh();
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not log this bottle share."
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="panel stack">
      <div className="section-title">
        <div>
          <h2>Sharing history</h2>
          <p>See who last tasted this bottle and capture the next outing quickly.</p>
        </div>
        {canQuickShare ? (
          <button className="button-subtle" onClick={() => setIsOpen((current) => !current)} type="button">
            {isOpen ? "Close quick share" : "Log taking this bottle"}
          </button>
        ) : null}
      </div>

      <div className="review-panel">
        <div className="meta-line">
          <span>Last shared: {summary.lastSharedAt ? formatDate(summary.lastSharedAt) : "Never"}</span>
        </div>
        {summary.people.length > 0 ? (
          <div>
            <p className="muted">People</p>
            <div className="pill-row">
              {summary.people.slice(0, 6).map((person) => (
                <span className="pill" key={person.personId}>
                  {person.name}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {summary.groups.length > 0 ? (
          <div>
            <p className="muted">Groups</p>
            <div className="pill-row">
              {summary.groups.slice(0, 4).map((group) => (
                <span className="pill" key={group.groupId}>
                  {group.name}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {summary.places.length > 0 ? (
          <div>
            <p className="muted">Places</p>
            <div className="pill-row">
              {summary.places.slice(0, 4).map((place) => (
                <span className="pill" key={place.placeId}>
                  {place.name}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {!summary.lastSharedAt ? (
          <p className="muted">No social history yet for this bottle.</p>
        ) : null}
      </div>

      {notice ? <div className={`status-note status-note-${notice.tone}`}>{notice.text}</div> : null}

      {!canQuickShare ? (
        <div className="status-note status-note-info">
          Only owned bottles that are not finished can be logged as a share.
        </div>
      ) : null}

      {isOpen && canQuickShare ? (
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="bottle-share-date">Date</label>
            <input
              id="bottle-share-date"
              type="datetime-local"
              value={form.sessionDate}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  sessionDate: event.target.value
                }))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="bottle-share-group">Group</label>
            <select
              id="bottle-share-group"
              value={form.groupId}
              onChange={(event) =>
                setForm((current) => ({
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
            <label htmlFor="bottle-share-place">Place</label>
            <select
              id="bottle-share-place"
              value={form.placeId}
              onChange={(event) =>
                setForm((current) => ({
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
          <div className="field">
            <label htmlFor="bottle-share-title">Title</label>
            <input
              id="bottle-share-title"
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value
                }))
              }
            />
          </div>
          <div className="field full-span">
            <label htmlFor="bottle-share-notes">Notes</label>
            <textarea
              id="bottle-share-notes"
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notes: event.target.value
                }))
              }
            />
          </div>
          <div className="field full-span">
            <label>People</label>
            {form.groupId && !hasAttendees ? (
              <div className="status-note status-note-error">
                The selected group has no members. Add at least one attendee before saving.
              </div>
            ) : null}
            <div className="tastings-checklist">
              {people.length === 0 ? (
                <div className="status-note status-note-info">Add a person in Tastings before using quick share.</div>
              ) : (
                people.map((person) => (
                  <label className="checkbox-label" key={person.id}>
                    <input
                      type="checkbox"
                      checked={form.attendeePersonIds.includes(person.id)}
                      onChange={(event) =>
                        setForm((current) => ({
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
            <button className="button" disabled={isSaving || !hasAttendees || !canQuickShare} type="submit">
              {isSaving ? "Saving..." : "Save share"}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
