import { useState } from 'react'
import type { ReactNode } from 'react'
import { Building2, CheckCircle2, Home, KeyRound, LandPlot, Moon, Store, X } from 'lucide-react'
import { useCurrentUser, useStore } from '../lib/storeContext'
import { deleteImpact, impactSentences } from '../lib/metrics'
import type { Chapter, ListingType, Property } from '../lib/types'
import { displayName } from '../lib/format'
import { Button, Modal, Note, NumberInput, Select, TextInput } from './ui'
import { DangerZone } from './forms'
import { PendingPhotos, SavedPhotos } from './PhotoManager'
import {
  PendingDocuments,
  PendingVideos,
  SavedDocuments,
  SavedVideos,
} from './ListingMedia'
import type { PendingDocument } from './ListingMedia'
import RichTextEditor from './RichTextEditor'

/*
 * The property form mirrors the website's agent upload form (AddProperty.tsx)
 * input for input — the same listing types, property types, areas, features,
 * labels, limits and required fields — so PropertyLoop's own stock reaches the
 * public site as complete as any agent's listing. Chapter, mandate and units
 * are what only the company records, and sit in their own section.
 */

const PRESET_FEATURES = [
  '24hr Power',
  'Borehole Water',
  'Swimming Pool',
  'Gym',
  'Air Conditioning',
  'Balcony',
  'Parking Space',
  'Security',
  'CCTV',
  'Furnished',
  'WiFi / Internet',
  'Elevator',
  'Generator',
  'Solar Power',
  'Garden',
  'Servant Quarters',
  'Smart Home',
  'Fireplace',
]

const LISTING_TYPES: { value: ListingType; label: string; sub: string; icon: ReactNode }[] = [
  { value: 'SALE', label: 'For Sale', sub: 'One-time purchase', icon: <Home size={18} /> },
  { value: 'RENT', label: 'For Rent', sub: 'Yearly tenancy', icon: <KeyRound size={18} /> },
  { value: 'SHORTLET', label: 'Shortlet', sub: 'Nightly stays', icon: <Moon size={18} /> },
]

const PROPERTY_TYPES: { label: string; icon: ReactNode }[] = [
  { label: 'Flat / Apartment', icon: <Building2 size={15} /> },
  { label: 'House', icon: <Home size={15} /> },
  { label: 'Land', icon: <LandPlot size={15} /> },
  { label: 'Commercial', icon: <Store size={15} /> },
]

const LOCATIONS = [
  'Lekki, Lagos',
  'Victoria Island, Lagos',
  'Ikoyi, Lagos',
  'Banana Island, Lagos',
  'Ajah, Lagos',
  'Gbagada, Lagos',
  'Surulere, Lagos',
  'Ikeja, Lagos',
  'Maryland, Lagos',
  'Yaba, Lagos',
  'Magodo, Lagos',
  'Ojodu, Lagos',
]

const OTHER = '__OTHER__'

/** "185000000" → "185,000,000", as the agent form formats the price field. */
function formatPriceInput(value: string): string {
  const digits = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const priceNumber = (formatted: string) => Number(formatted.replace(/\D/g, '')) || 0
const plainText = (html: string) => html.replace(/<[^>]*>/g, '').trim()
const count = (raw: string, fallback = 0) => {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

/** A labelled block. A div, not a <label>: several of these hold more than one control. */
function Group({
  label,
  hint,
  error,
  children,
}: {
  label: ReactNode
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div>
      <span className="mb-1 block text-[11px] font-semibold tracking-wider text-ink-3 uppercase">
        {label}
      </span>
      {hint && <p className="mb-1.5 text-xs text-ink-3">{hint}</p>}
      {children}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  )
}

function Optional({ children }: { children: ReactNode }) {
  return (
    <>
      {children} <span className="font-normal normal-case">(optional)</span>
    </>
  )
}

function Section({ children }: { children: ReactNode }) {
  return (
    <h3 className="border-t border-line pt-4 text-xs font-bold tracking-[0.08em] text-primary uppercase first:border-t-0 first:pt-0">
      {children}
    </h3>
  )
}

export function PropertyForm({
  existing,
  onClose,
}: {
  existing?: Property
  onClose: () => void
}) {
  const me = useCurrentUser()
  const { addProperty, updateProperty, deleteProperty, deals, properties, leads, shoots, threads } =
    useStore()
  const editing = existing !== undefined

  /* The public listing — the agent form's inputs. */
  const [type, setType] = useState<ListingType>(existing?.type ?? 'SALE')
  const [propertyType, setPropertyType] = useState(existing?.propertyType ?? '')
  const [title, setTitle] = useState(existing?.title ?? '')
  const [address, setAddress] = useState(existing?.address ?? '')
  const [location, setLocation] = useState(existing?.location ?? '')
  const [customLocation, setCustomLocation] = useState(
    Boolean(existing?.location) && !LOCATIONS.includes(existing?.location ?? ''),
  )
  const [beds, setBeds] = useState(existing ? String(existing.beds) : '')
  const [baths, setBaths] = useState(existing ? String(existing.baths) : '')
  const [size, setSize] = useState(existing?.sqft ?? '')
  const [yearBuilt, setYearBuilt] = useState(existing?.yearBuilt ?? '')
  const [price, setPrice] = useState(existing ? formatPriceInput(String(existing.priceNaira)) : '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [features, setFeatures] = useState<string[]>(existing?.features ?? [])
  const [customFeature, setCustomFeature] = useState('')
  const [virtualTourUrl, setVirtualTourUrl] = useState(existing?.virtualTourUrl ?? '')

  /* What only the company records. */
  const [chapter, setChapter] = useState<Chapter>(
    existing?.chapter ?? (me.chapter === 'OSUN' ? 'OSUN' : 'LAGOS'),
  )
  const [dealId, setDealId] = useState(existing?.dealId ?? '')
  const [units, setUnits] = useState(existing ? String(existing.units) : '1')
  const [unitsSold, setUnitsSold] = useState(existing ? String(existing.unitsSold) : '0')

  /* Files for a new property, uploaded once it is filed. */
  const [newPhotos, setNewPhotos] = useState<File[]>([])
  const [newDocs, setNewDocs] = useState<PendingDocument[]>([])
  const [newVideos, setNewVideos] = useState<File[]>([])
  const [videoLinks, setVideoLinks] = useState<string[]>([])
  const [confirmed, setConfirmed] = useState(false)
  const [showErrors, setShowErrors] = useState(false)

  const linkable = deals.filter((d) => d.stage !== 'LOST' && d.kind !== 'ADVERTISER')
  const priceLabel =
    type === 'SALE' ? 'Price (₦)' : type === 'RENT' ? 'Annual Rent (₦)' : 'Price per Night (₦)'

  // The agent form's three validation steps, checked together.
  const errors: Record<string, string> = {}
  if (!propertyType) errors.propertyType = 'Select a property type'
  if (!title.trim()) errors.title = 'Property title is required'
  if (!address.trim()) errors.address = 'Address is required'
  if (!location.trim()) errors.location = 'Select a location'
  if (!price.trim()) errors.price = 'Price is required'
  if (!plainText(description)) errors.description = 'Please describe your property'
  if (!editing && newPhotos.length === 0) {
    errors.photos = 'Add at least one property photo to continue'
  }
  if (virtualTourUrl.trim() && !/^https?:\/\//i.test(virtualTourUrl.trim())) {
    errors.virtualTourUrl = 'Enter the full link, starting with https://'
  }
  if (!editing && !confirmed) errors.terms = 'You must confirm before filing'
  const valid = Object.keys(errors).length === 0
  const shown: Record<string, string> = showErrors ? errors : {}

  function toggleFeature(f: string) {
    setFeatures((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]))
  }

  function addCustomFeature() {
    const value = customFeature.trim()
    if (value && !features.includes(value)) setFeatures((prev) => [...prev, value])
    setCustomFeature('')
  }

  function submit() {
    if (!valid) {
      setShowErrors(true)
      return
    }
    const unitCount = Math.max(1, count(units, 1))
    const common = {
      type,
      propertyType,
      title: title.trim(),
      address: address.trim(),
      location: location.trim(),
      beds: count(beds),
      baths: count(baths),
      sqft: size.trim(),
      priceNaira: priceNumber(price),
      description,
      features,
      chapter,
      // The developer is whoever signed the mandate, not a second free-text copy.
      developer: linkable.find((d) => d.id === dealId)?.company ?? null,
      dealId: dealId || null,
      units: unitCount,
    }
    if (editing) {
      updateProperty(existing.id, {
        ...common,
        yearBuilt: yearBuilt.trim() || null,
        virtualTourUrl: virtualTourUrl.trim() || null,
        unitsSold: Math.min(count(unitsSold), unitCount),
      })
    } else {
      addProperty({
        ...common,
        yearBuilt: yearBuilt.trim(),
        virtualTourUrl: virtualTourUrl.trim(),
        videoLinks,
        photoCount: newPhotos.length,
        photos: newPhotos,
        documents: newDocs,
        videos: newVideos,
      })
    }
    onClose()
  }

  // A live listing must be paused first. Deleting something the public site is
  // serving should never be one click inside an edit dialog.
  const blocked =
    existing?.status === 'ACTIVE'
      ? 'This listing is published on propertyloop.ng. Pause it first, then delete.'
      : undefined

  const impact = existing
    ? impactSentences(deleteImpact('PROPERTY', existing.id, { properties, leads, shoots, threads }))
    : []

  const chip = (on: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
      on
        ? 'border-primary bg-primary text-white'
        : 'border-line bg-surface text-ink-2 hover:border-primary/40 hover:text-primary'
    }`

  return (
    <Modal
      title={editing ? 'Edit property' : 'Add a property'}
      subtitle={
        editing
          ? 'Changes apply immediately — verification status follows the documents'
          : 'The same details the website asks agents for — filed as pending review'
      }
      accent="green"
      onClose={onClose}
      footer={
        <>
          {showErrors && !valid && (
            <span className="mr-auto text-xs text-rose-600">Fill in the highlighted fields</span>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            {editing ? 'Save changes' : 'File for review'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Section>Property details</Section>

        <Group label="Listing type">
          <div className="grid grid-cols-3 gap-2">
            {LISTING_TYPES.map((lt) => {
              const on = type === lt.value
              return (
                <button
                  key={lt.value}
                  type="button"
                  onClick={() => setType(lt.value)}
                  aria-pressed={on}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    on ? 'border-primary bg-primary-soft' : 'border-line bg-surface hover:border-primary/40'
                  }`}
                >
                  <span
                    className={`mb-1.5 grid h-8 w-8 place-items-center rounded-lg ${
                      on ? 'bg-surface text-primary' : 'bg-surface-2 text-ink-2'
                    }`}
                  >
                    {lt.icon}
                  </span>
                  <b className="block text-sm font-semibold text-ink">{lt.label}</b>
                  <span className="text-[11px] text-ink-3">{lt.sub}</span>
                </button>
              )
            })}
          </div>
        </Group>

        <Group label="Property Type" error={shown.propertyType}>
          <div className="flex flex-wrap gap-1.5">
            {PROPERTY_TYPES.map((pt) => (
              <button
                key={pt.label}
                type="button"
                onClick={() => setPropertyType(pt.label)}
                aria-pressed={propertyType === pt.label}
                className={chip(propertyType === pt.label)}
              >
                {pt.icon}
                {pt.label}
              </button>
            ))}
          </div>
        </Group>

        <Group label="Property Title" error={shown.title}>
          <TextInput
            value={title}
            onChange={setTitle}
            placeholder="e.g. Luxury 4-Bed Duplex in Lekki"
          />
        </Group>

        <Group label="Property Address" error={shown.address}>
          <TextInput value={address} onChange={setAddress} placeholder="Full property address" />
        </Group>

        <Group label="Location / Area" error={shown.location}>
          <Select
            value={customLocation ? OTHER : LOCATIONS.includes(location) ? location : ''}
            onChange={(v) => {
              if (v === OTHER) {
                setCustomLocation(true)
                setLocation('')
              } else {
                setCustomLocation(false)
                setLocation(v)
              }
            }}
          >
            <option value="">Select area</option>
            {LOCATIONS.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
            <option value={OTHER}>Other (enter manually)</option>
          </Select>
          {customLocation && (
            <TextInput
              value={location}
              onChange={setLocation}
              placeholder="Enter your location/area"
              className="mt-2"
            />
          )}
        </Group>

        <div className="grid grid-cols-2 gap-3">
          <Group label="Bedrooms">
            <NumberInput value={beds} onChange={setBeds} placeholder="0" />
          </Group>
          <Group label="Bathrooms">
            <NumberInput value={baths} onChange={setBaths} placeholder="0" />
          </Group>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Group label={<Optional>Size (m²)</Optional>}>
            <TextInput value={size} onChange={setSize} placeholder="e.g. 2,400" />
          </Group>
          <Group label={<Optional>Year Built</Optional>}>
            <TextInput value={yearBuilt} onChange={setYearBuilt} placeholder="e.g. 2022" />
          </Group>
        </div>

        <Group label={priceLabel} error={shown.price}>
          <TextInput
            value={price}
            onChange={(v) => setPrice(formatPriceInput(v))}
            placeholder="e.g. 185,000,000"
          />
        </Group>

        <Group label="Description" error={shown.description}>
          <RichTextEditor
            value={description}
            onChange={setDescription}
            placeholder="Describe your property - features, condition, neighbourhood highlights…"
          />
        </Group>

        <Group label="Features & Amenities" hint="Tap any that apply, or add your own.">
          <div className="flex flex-wrap gap-1.5">
            {PRESET_FEATURES.map((f) => {
              const on = features.includes(f)
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleFeature(f)}
                  aria-pressed={on}
                  className={chip(on)}
                >
                  {on && <CheckCircle2 size={12} />}
                  {f}
                </button>
              )
            })}
            {features
              .filter((f) => !PRESET_FEATURES.includes(f))
              .map((f) => (
                <button key={f} type="button" onClick={() => toggleFeature(f)} className={chip(true)}>
                  <CheckCircle2 size={12} />
                  {f}
                  <X size={12} className="opacity-70" />
                </button>
              ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={customFeature}
              placeholder="Add custom feature (e.g. Boys' Quarters)"
              onChange={(e) => setCustomFeature(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCustomFeature()
                }
              }}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <Button onClick={addCustomFeature} disabled={!customFeature.trim()}>
              Add
            </Button>
          </div>
          {features.length > 0 && (
            <p className="mt-1.5 text-[11px] text-ink-3">{features.length} selected</p>
          )}
        </Group>

        <Section>PropertyLoop records</Section>

        <div className="grid gap-3 sm:grid-cols-2">
          <Group label="Chapter">
            <Select value={chapter} onChange={(v) => setChapter(v as Chapter)}>
              <option value="LAGOS">Lagos</option>
              <option value="OSUN">Osun</option>
            </Select>
          </Group>
          <Group label="From which mandate?">
            <Select value={dealId} onChange={setDealId}>
              <option value="">Not from a deal</option>
              {linkable.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.company}
                </option>
              ))}
            </Select>
          </Group>
        </div>

        <div className={`grid gap-3 ${editing ? 'grid-cols-2' : ''}`}>
          <Group label="Units">
            <NumberInput value={units} onChange={setUnits} min={1} />
          </Group>
          {editing && (
            <Group label="Units sold">
              <NumberInput value={unitsSold} onChange={setUnitsSold} />
            </Group>
          )}
        </div>

        <Section>Photos &amp; documents</Section>

        <Group
          label="Property Photos"
          hint="Listings with 6+ photos and verified documents get up to 4× more enquiries."
          error={shown.photos}
        >
          {editing ? (
            <SavedPhotos propertyId={existing.id} />
          ) : (
            <PendingPhotos files={newPhotos} onChange={setNewPhotos} />
          )}
        </Group>

        <Group label="Documents (C of O, Survey Plan)">
          {editing ? (
            <SavedDocuments propertyId={existing.id} />
          ) : (
            <PendingDocuments items={newDocs} onChange={setNewDocs} />
          )}
        </Group>

        <Group label={<Optional>Virtual Tour URL</Optional>} error={shown.virtualTourUrl}>
          <TextInput
            value={virtualTourUrl}
            onChange={setVirtualTourUrl}
            placeholder="https://my360tour.com/property/..."
          />
        </Group>

        <Group
          label={<Optional>Property Video</Optional>}
          hint="Add a video walkthrough or showcase. You can upload a file or paste a video URL."
        >
          {editing ? (
            <SavedVideos propertyId={existing.id} />
          ) : (
            <PendingVideos
              files={newVideos}
              onFilesChange={setNewVideos}
              links={videoLinks}
              onLinksChange={setVideoLinks}
            />
          )}
        </Group>

        {editing ? (
          <DangerZone
            what="property"
            impact={impact}
            blocked={blocked}
            onDelete={() => {
              deleteProperty(existing.id)
              onClose()
            }}
          />
        ) : (
          <>
            <Note>
              Filed as <strong>pending review</strong> — nothing is public until it is
              published, and documents stay unverified until somebody checks them. This
              listing is attributed to <strong>{displayName(me)}</strong> as the person who
              sourced it.
            </Note>
            <div>
              <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed text-ink-2">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-primary)]"
                />
                <span>
                  I confirm that the information provided is accurate and that PropertyLoop
                  holds a mandate to list this property.
                </span>
              </label>
              {shown.terms && <p className="mt-1 text-xs text-rose-600">{shown.terms}</p>}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
