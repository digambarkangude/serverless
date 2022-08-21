import AWS from 'aws-sdk'
import commonMiddleware from '../lib/commonMiddleware'
import createErrors from 'http-errors'
import validator from '@middy/validator'
import { getAuctionById } from './getAuction'
import placeBidSchema from '../lib/schemas/placeBidSchema'

const dynamodb = new AWS.DynamoDB.DocumentClient()
async function placeBid(event, context) {
  
  const {id} = event.pathParameters
  const {amount} = event.body
  const {email} = event.requestContext.authorizer
  const auction = await getAuctionById(id)

  if(auction.status !== 'OPEN'){
    throw new createErrors.Forbidden(`You can not bid closed auctions`)
  }

  if(amount<=auction.highestBid.amount){
    throw new createErrors.Forbidden(`Your bid must be higher than ${auction.highestBid.amount}`)
  }

  if(email === auction.seller){
    throw new createErrors.Forbidden(`You cannot bid on your own auction`)
  }

  if(email === auction.highestBid.bidder){
    throw new createErrors.Forbidden(`You are already heighest bidder`)
  }
  
  const params = {
    TableName: process.env.AUCTIONS_TABLE_NAME,
    Key: {id},
    UpdateExpression: 'set highestBid.amount = :amount, highestBid.bidder = :bidder',
    ExpressionAttributeValues:{
      ':amount': amount,
      ':bidder': email
    },
    ReturnValues: 'ALL_NEW',
  }

  let updatedAuction

  try {
    const result = await dynamodb.update(params).promise()
    updatedAuction = result.Attributes
  } catch (error) {
    console.error(error)
    throw new createErrors.InternalServerError(error)
  }

  return {
    statusCode: 200,
    body: JSON.stringify(updatedAuction),
  };
}
export const handler = commonMiddleware(placeBid)
  .use(validator({
    inputSchema: placeBidSchema,
    ajvOptions: {
      useDefaults: true,
      strict: false,
    },
  }));


