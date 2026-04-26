from core.exceptions import ConflictError


def validate_status_transition(current_status, new_status, allowed_transitions, label):
    allowed_next = allowed_transitions.get(current_status, set())
    if new_status == current_status:
        return
    if new_status not in allowed_next:
        raise ConflictError(
            f"Cannot change {label} status from '{current_status}' to '{new_status}'."
        )
