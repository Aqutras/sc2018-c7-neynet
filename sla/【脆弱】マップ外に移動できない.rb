send(ch: 'character_move', data: { x: -1, y: 0 })
wait_for_response('update_character_location')
return false if check_response('update_character_location', ['{"x":-1,"y":0}'])
sleep 1.0

send(ch: 'character_move', data: { x: 0, y: -1 })
wait_for_response('update_character_location')
return false if check_response('update_character_location', ['{"x":0,"y":-1}'])
true
