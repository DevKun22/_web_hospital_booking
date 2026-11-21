// Tên thiết bị cho phiên đăng nhập web, suy ra từ User-Agent của trình duyệt và header vị trí do Vercel gắn.
// Backend chỉ thấy máy chủ Next.js nên không tự biết được; tên và vị trí gần đúng được ghép vào deviceName.

const BROWSERS: Array<[RegExp, string]> = [
  [/Edg(e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser/, "Samsung Internet"],
  [/(Chrome|CriOS)\//, "Chrome"],
  [/(Firefox|FxiOS)\//, "Firefox"],
  [/Safari\//, "Safari"],
];

// iOS đứng trước macOS và Android đứng trước Linux vì User-Agent của chúng chứa cả hai chuỗi.
const SYSTEMS: Array<[RegExp, string]> = [
  [/iPhone|iPod/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
];

const FALLBACK = "Trình duyệt Web";
const MAX_LENGTH = 128;
const SEPARATOR = " · ";

export function describeDevice(userAgent: string | null | undefined) {
  const agent = userAgent || "";
  const browser = BROWSERS.find(([pattern]) => pattern.test(agent))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(agent))?.[1];
  if (browser && system) return `${browser} trên ${system}`;
  return browser || system || FALLBACK;
}

function countryName(code: string) {
  try {
    return new Intl.DisplayNames(["vi"], { type: "region" }).of(code.toUpperCase()) || code;
  } catch {
    return code;
  }
}

// Vị trí gần đúng theo địa chỉ mạng; header của Vercel mã hóa phần trăm tên thành phố.
export function describeLocation(city: string | null | undefined, country: string | null | undefined) {
  let cityName = "";
  try {
    cityName = city ? decodeURIComponent(city).trim() : "";
  } catch {
    cityName = "";
  }
  const countryLabel = country && /^[A-Za-z]{2}$/.test(country) ? countryName(country) : "";
  return [cityName, countryLabel].filter(Boolean).join(", ");
}

type HeaderSource = { get(name: string): string | null };

export function buildWebDeviceName(headers: HeaderSource) {
  const device = describeDevice(headers.get("user-agent"));
  const location = describeLocation(headers.get("x-vercel-ip-city"), headers.get("x-vercel-ip-country"));
  return (location ? `${device}${SEPARATOR}${location}` : device).slice(0, MAX_LENGTH);
}

// Tách chuỗi deviceName thành tên thiết bị và vị trí để hiển thị.
export function splitDeviceName(deviceName: string | null | undefined) {
  const [device, ...rest] = (deviceName || "").split(SEPARATOR);
  return { device: device.trim(), location: rest.join(SEPARATOR).trim() };
}
