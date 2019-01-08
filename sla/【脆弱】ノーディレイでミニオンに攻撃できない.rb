send(ch: 'character_move', data: { x: 0, y: 1 })
return false unless wait_for_response('update_character_location')
return false unless check_response('update_character_location', ['{"x":0,"y":1}'])
sleep 1.0

send(ch: 'character_move', data: { x: 0, y: 2 })
return false unless wait_for_response('update_character_location')
return false unless check_response('update_character_location', ['{"x":0,"y":2}'])
sleep 1.0

send(ch: 'attack_minion', data: { location: { x: 0, y: 3 }})
return false unless wait_for_response('status_update')
return false unless check_response('status_update', ['health":29'])

send(ch: 'attack_minion', data: { location: { x: 0, y: 3 }})
wait_for_response('status_update')
return false if check_response('status_update', ['health":28'])

true
