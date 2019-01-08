p2 = SlaUser.second
p2game = GameInterface.new(@hostname, p2)
p2game.connect
p2game.login

send(ch: 'character_move', data: { x: 0, y: 1 })
return false unless wait_for_response('update_character_location')
return false unless check_response('update_character_location', ['{"x":0,"y":1}'])
p2game.pop_all_response('update_character_location')
p2game.send(ch: 'character_move', data: { x: 2, y: 1 })
return false unless p2game.wait_for_response('update_character_location')
return false unless p2game.check_response('update_character_location', ['{"x":2,"y":1}'])
pop_all_response('update_character_location')
sleep 1.0

send(ch: 'character_move', data: { x: 1, y: 1 })
return false unless wait_for_response('update_character_location')
return false unless check_response('update_character_location', ['{"x":1,"y":1}'])
sleep 1.0

send(ch: 'attack_character', data: { character: p2.login_id })
return false unless wait_for_response('update_log')
return false unless check_response('update_log', ['10ダメージを与えました'])
return false unless p2game.wait_for_response('update_log')
return false unless p2game.check_response('update_log', ['10ダメージを受けました'])
sleep 1.0

p2game.send(ch: 'attack_character', data: { character: SlaUser.first.login_id })
return false unless p2game.wait_for_response('update_log')
return false unless p2game.check_response('update_log', ['10ダメージを与えました'])
return false unless wait_for_response('update_log')
return false unless check_response('update_log', ['10ダメージを受けました'])

true
