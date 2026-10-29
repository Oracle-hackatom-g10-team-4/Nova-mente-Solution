"""Public rebuild recipe: intent only, without prompts, conversation or credentials."""
def recipe(request):
    value = request.model_dump(exclude={'decision', 'conversation_context'})
    if request.decision.agent_source in ('policy', 'typesafe'):
        value['agent_id'] = 'auto'
    return value
