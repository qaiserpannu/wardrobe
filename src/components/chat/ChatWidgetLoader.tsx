import { isWhatsAppConfigured } from "@/integrations/whatsapp";
import { getCachedSettings } from "@/server/services/cached";
import { ChatWidget } from "./ChatWidget";

/** Reads the widget's settings on the server. Shows nothing if it is switched off or no number is set. */
export async function ChatWidgetLoader() {
  const { chat_widget: widget, whatsapp, branding } = await getCachedSettings();
  if (!widget.enabled || !isWhatsAppConfigured(whatsapp.number)) return null;
  return (
    <ChatWidget
      siteName={branding.siteName}
      title={widget.title}
      greeting={widget.greeting}
      position={widget.position}
      whatsapp={{
        number: whatsapp.number,
        productMessage: whatsapp.productMessage,
        generalMessage: whatsapp.generalMessage,
      }}
    />
  );
}
