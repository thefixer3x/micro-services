import './apidocs.css'

const apidocs = () =>{
    return (
        <div>
            <section class="api-integration">
        <div class="container">
            <div class="api-text">
                <h2>Automate Your Payouts with Our REST API</h2>
                <p>Integrate grizzen directly into your platform with our developer-friendly API. 
                   Trigger payouts, manage recipients, and track transactions programmatically.</p>
                <a href="#" class="cta-button">Explore API Docs</a>
            </div>
    
            <div class="api-code">
                <pre>
                    <code>
                        {`fetch('https://api.grizzen.com/v1/transfer', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer YOUR_API_KEY'
                            },
                            body: JSON.stringify({
                                amount: 1000,
                                currency: 'USD',
                                recipient: 'john.doe@example.com'
                            })
                        })
                        .then(response => response.json())
                        .then(data => console.log(data))
                        .catch(error => console.error(error));`}
                    </code>
                </pre>
            </div>
        </div>
    </section>
    
        </div>
    )
}


export default apidocs