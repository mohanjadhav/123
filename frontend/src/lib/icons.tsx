import type { ComponentType, ReactNode } from "react";
import {
  Award, Baby, BadgeCheck, Ban, Calendar, CircleCheck, Clock, Flame, GlassWater, Globe, Hand, Heart, Info, Leaf, Mail, MapPin,
  Package, Phone, Recycle, ShieldCheck, Snowflake, Star, Sun, Thermometer, TriangleAlert, Truck, Umbrella, Zap,
} from "lucide-react";

type Lucide = ComponentType<{ className?: string; strokeWidth?: number; color?: string }>;

/** Vector symbols for labels. Rendered as SVG so they stay crisp at any print resolution. */
export interface IconDef { key: string; label: string; group: string; color?: string; render: (color: string) => ReactNode }

const lucide = (C: Lucide) => (color: string) => <C className="block h-full w-full" color={color} strokeWidth={2} />;

const VegMark = ({ color, nonVeg }: { color: string; nonVeg?: boolean }) => (
  <svg viewBox="0 0 24 24" className="block h-full w-full">
    <rect x="1.5" y="1.5" width="21" height="21" fill="none" stroke={color} strokeWidth="2.2" />
    {nonVeg ? <path d="M12 5.5 L18.5 17.5 H5.5 Z" fill={color} /> : <circle cx="12" cy="12" r="5.5" fill={color} />}
  </svg>
);
const ThisWayUp = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" className="block h-full w-full" fill={color}>
    <path d="M6.5 3 L11 8.5 H8 V17 H5 V8.5 H2 Z M17.5 3 L22 8.5 H19 V17 H16 V8.5 H13 Z" /><rect x="2" y="19" width="20" height="2" />
  </svg>
);

export const ICONS: IconDef[] = [
  { key: "veg", label: "Veg mark", group: "Food", color: "#0F9D58", render: (c) => <VegMark color={c} /> },
  { key: "nonveg", label: "Non-veg mark", group: "Food", color: "#8B4513", render: (c) => <VegMark color={c} nonVeg /> },
  { key: "leaf", label: "Natural / organic", group: "Food", render: lucide(Leaf) },
  { key: "snowflake", label: "Keep frozen", group: "Food", render: lucide(Snowflake) },
  { key: "thermometer", label: "Temperature", group: "Food", render: lucide(Thermometer) },
  { key: "sun", label: "Keep away from sunlight", group: "Food", render: lucide(Sun) },
  { key: "fragile", label: "Fragile", group: "Packaging", render: lucide(GlassWater) },
  { key: "thiswayup", label: "This way up", group: "Packaging", render: (c) => <ThisWayUp color={c} /> },
  { key: "keepdry", label: "Keep dry", group: "Packaging", render: lucide(Umbrella) },
  { key: "handle", label: "Handle with care", group: "Packaging", render: lucide(Hand) },
  { key: "recycle", label: "Recycle", group: "Packaging", render: lucide(Recycle) },
  { key: "package", label: "Package", group: "Packaging", render: lucide(Package) },
  { key: "truck", label: "Delivery", group: "Packaging", render: lucide(Truck) },
  { key: "warning", label: "Warning", group: "Safety", render: lucide(TriangleAlert) },
  { key: "flame", label: "Flammable", group: "Safety", render: lucide(Flame) },
  { key: "electric", label: "Electric", group: "Safety", render: lucide(Zap) },
  { key: "nochild", label: "Keep away from children", group: "Safety", render: lucide(Baby) },
  { key: "ban", label: "Not allowed", group: "Safety", render: lucide(Ban) },
  { key: "info", label: "Info", group: "Safety", render: lucide(Info) },
  { key: "phone", label: "Phone", group: "Contact", render: lucide(Phone) },
  { key: "mail", label: "Email", group: "Contact", render: lucide(Mail) },
  { key: "web", label: "Website", group: "Contact", render: lucide(Globe) },
  { key: "location", label: "Address", group: "Contact", render: lucide(MapPin) },
  { key: "calendar", label: "Date", group: "Contact", render: lucide(Calendar) },
  { key: "clock", label: "Time", group: "Contact", render: lucide(Clock) },
  { key: "quality", label: "Quality checked", group: "Badges", render: lucide(BadgeCheck) },
  { key: "award", label: "Award", group: "Badges", render: lucide(Award) },
  { key: "shield", label: "Guarantee", group: "Badges", render: lucide(ShieldCheck) },
  { key: "check", label: "Approved", group: "Badges", render: lucide(CircleCheck) },
  { key: "star", label: "Star", group: "Badges", render: lucide(Star) },
  { key: "heart", label: "Heart", group: "Badges", render: lucide(Heart) },
];

export const iconByKey = (k: string) => ICONS.find((i) => i.key === k);
