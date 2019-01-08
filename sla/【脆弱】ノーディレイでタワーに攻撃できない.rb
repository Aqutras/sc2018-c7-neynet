send(ch: 'character_move', data: { x: 0, y: 1 })
return false unless wait_for_response('update_character_location')
return false unless check_response('update_character_location', ['{"x":0,"y":1}'])
sleep 1.0

send(ch: 'character_move', data: { x: 0, y: 2 })
return false unless wait_for_response('update_character_location')
return false unless check_response('update_character_location', ['{"x":0,"y":2}'])
sleep 1.0

send(ch: 'attack_tower', data: {})
return false unless wait_for_response('update_log')
return false unless check_response('update_log', ['タワーに10ダメージを与えました。'])

send(ch: 'attack_tower', data: {})
wait_for_response('update_log')
return false if check_response('update_log', ['タワーに10ダメージを与えました。'])

true
