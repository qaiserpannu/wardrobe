import { isWhatsAppConfigured } from "@/integrations/whatsapp";
import { isAgentConfigured } from "@/server/agent/providers";
import { getCachedSettings } from "@/server/services/cached";
import { ChatWidget } from "./ChatWidget";

/**
 * Reads the widget's settings on the server. Shows nothing if it is switched off
 * or no number is set. The AI assistant appears only when it is switched on and
 * a provider is configured; otherwise the panel is the plain WhatsApp one.
 */
export async function ChatWidgetLoader() {
  const { chat_widget: widget, whatsapp, branding, ai_assistant: ai } = await getCachedSettings();
  if (!widget.enabled || !isWhatsAppConfigured(whatsapp.number)) return null;
  return (
    <ChatWidget
      siteName={branding.siteName}
      title={widget.title}
      greeting={widget.greeting}
      position={widget.position}
      assistant={ai.enabled && isAgentConfigured() ? { name: ai.name, greeting: ai.greeting } : null}
      whatsapp={{
        number: whatsapp.number,
        productMessage: whatsapp.productMessage,
        generalMessage: whatsapp.generalMessage,
      }}
    />
  );
}
