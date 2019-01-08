send(ch: 'character_move', data: { x: 1, y: 1 })
wait_for_response('update_character_location')
return false if check_response('update_character_location', ['{"x":1,"y":1}'])

true
