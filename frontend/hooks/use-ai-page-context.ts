import { useEffect } from "react";
import {
  AiPageContext,
  inferPageType,
  setAiPageContext,
} from "@/lib/ai-context";

export const useAiPageContext = (context: AiPageContext) => {
  useEffect(() => {
    const route =
      context.route ?? (typeof window !== "undefined" ? window.location.pathname : undefined);
    setAiPageContext({
      pageType: context.pageType ?? inferPageType(route),
      ...context,
      route,
    });
  }, [context]);
};
