from typing import TypedDict

class ClassificationResult(TypedDict):
    category: str
    confidence: float
    reason: str



def classify_activity(
        application: str,
        window_title: str | None = None,
) -> ClassificationResult:
    app = application.lower()
    title = (window_title or "").lower()

    text = f"{app} {title}"

    if any(keyword in text for keyword in [
        "visual studio code", "code", "cursor", "intellij",
        "pycharm", "terminal", "powershell", "cmd",
        "github", "git", ".ts", ".tsx", ".js", ".jsx", ".py",
    ]):
        return {
            "category": "DEVELOPMENT",
            "confidence": 0.95,
            "reason": "The application or window appears related to software development.",
        }


    if any(keyword in text for keyword in [
        "figma", "photoshop", "illustrator", "canva",
        "blender", "design",
    ]):
        return {
            "category": "DESIGN",
            "confidence": 0.95,
            "reason": "The application or window appears related to design work.",
        }


    if any(keyword in text for keyword in [
        "slack", "discord", "teams", "zoom", "meet",
        "whatsapp", "telegram", "messenger",
        "mail", "gmail", "outlook",
    ]):
        return {
            "category": "COMMMUNICATION",
            "confidence": 0.90,
            "reason": "The application or window appears related to communication.",
        }


    if any(keyword in text for keyword in [
        "google", "bing", "stackoverflow", "stack overflow",
        "documentation", "research", "wikipedia", "mozilla", "mdn",
    ]):
        return {
            "category": "RESEARCH",
            "confidence": 0.85,
            "reason": "The application or window appears related to research or information gathering.",
        }


    if any(keyword in text for keyword in [
        "word", "notion", "google docs", "document",
        "docs", "writing",
    ]):
        return {
            "category": "DOCUMENTATION",
            "confidence": 0.85,
            "reason": "The application or window appears related to writing and documentation."
        }


    return {
        "category": "OTHER",
        "confidence": 0.50,
        "reason": "There was not enough information to confidently classify this activity."
    }